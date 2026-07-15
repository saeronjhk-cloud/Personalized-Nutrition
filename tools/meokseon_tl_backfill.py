#!/usr/bin/env python3
"""
먹선 신호등 캐시 워밍 + scan_history 색 백필 (IP/136 P0-2 · 세션30)

목적
  선행 마이그레이션(IP/136_meokseon_traffic_light_snapshot_v1.sql)으로 추가된
  scan_history.sodium_color / sugars_color 를 **기존 행**에 대해 채운다.
  신규 행은 클라이언트(P1-1) 또는 BEFORE INSERT 트리거가 채우므로 이 잡의 대상이 아니다.

  동시에 IP/136 §1.8 의 **미확인 4건을 실측으로 해소**한다:
    ① scan_history 실 적재량  ② 색 결측률  ③ 바코드 매칭률  ④ traffic_light 결측 패턴

원칙
  · 먹선 정본 판정을 **그대로 스냅샷**한다. 자체 임계값을 만들지 않는다(web/src/lib/meokseon.ts:51).
  · 색 결측(null) = "판정 없음" ≠ 안전. 모르는 것을 green 으로 메우지 않는다.
  · **부분 성공 허용**. API 실패 바코드는 skip 후 다음 회차 재시도. 잡이 전체 실패하지 않는다.
  · 결정론(원칙5). AI 추론 0. HTTP GET + 결정론 변환만.
  · 멱등. 반복 실행해도 같은 결과. --dry-run 으로 쓰기 없이 실측만 가능.

개인정보
  이 잡은 **제품 팩트만** 다룬다. meokseon_tl_cache 에 사용자 식별자를 저장하지 않는다.
  scan_history 는 UPDATE 만 하며(색 2칸), 행을 생성/삭제하지 않는다. 신규 결합 없음(IP/136 §6).

사용
  export SUPABASE_URL=https://lrnuqhpgyuizfggxgxpl.supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=...        # RLS 우회 필요(scan_history 에 UPDATE 정책이 없음)
  export MEOKSEON_API_URL=https://<railway>   # web 의 VITE_MEOKSEON_API_URL 과 동일 값
  python3 tools/meokseon_tl_backfill.py --dry-run     # 실측만, 쓰기 없음
  python3 tools/meokseon_tl_backfill.py               # 캐시 워밍 + 백필
  python3 tools/meokseon_tl_backfill.py --report-only # 채움률만 출력

수용 기준(IP/136 §5): 색 채움률 >= 90%. 미달 시 미매칭 바코드 목록을 출력한다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from typing import Any

VALID_COLORS = {"green", "yellow", "red"}
FILL_RATE_TARGET = 0.90
PAGE = 1000
TIMEOUT = 15
RETRIES = 3
SLEEP_BETWEEN = 0.15   # 먹선 서버 예의(rate limit 회피)


# ── 설정 ──────────────────────────────────────────────────────────────────
def env(name: str, required: bool = True) -> str:
    v = os.environ.get(name, "").strip()
    if required and not v:
        sys.exit(f"[중단] 환경변수 {name} 가 필요합니다. 파일 상단 docstring 참고.")
    return v


def normalize_base(u: str) -> str:
    """web/src/lib/meokseon.ts:9-17 의 정규화와 동일 — 스킴 누락 시 https:// 부여."""
    u = u.strip().rstrip("/")
    if u and "://" not in u:
        u = "https://" + u
    return u


# ── Supabase PostgREST (의존성 없이 표준 라이브러리만) ────────────────────
class Rest:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.key = key

    def _req(self, method: str, path: str, body: Any = None, extra_headers: dict | None = None) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"{self.url}/rest/v1/{path}", data=data, method=method)
        req.add_header("apikey", self.key)
        req.add_header("Authorization", f"Bearer {self.key}")
        req.add_header("Content-Type", "application/json")
        for k, v in (extra_headers or {}).items():
            req.add_header(k, v)
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw.strip() else None

    def select(self, path: str) -> list[dict]:
        return self._req("GET", path) or []

    def count(self, table: str, where: str = "") -> int:
        """PostgREST 의 Content-Range 로 정확한 행 수를 센다."""
        q = f"{table}?select=id&limit=1" + (f"&{where}" if where else "")
        req = urllib.request.Request(f"{self.url}/rest/v1/{q}", method="GET")
        req.add_header("apikey", self.key)
        req.add_header("Authorization", f"Bearer {self.key}")
        req.add_header("Prefer", "count=exact")
        req.add_header("Range-Unit", "items")
        req.add_header("Range", "0-0")
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            cr = r.headers.get("Content-Range", "*/0")
        return int(cr.split("/")[-1]) if cr.split("/")[-1].isdigit() else 0

    def upsert(self, table: str, rows: list[dict]) -> None:
        if rows:
            self._req("POST", f"{table}?on_conflict=barcode", rows,
                      {"Prefer": "resolution=merge-duplicates,return=minimal"})

    def patch(self, table: str, where: str, body: dict) -> None:
        self._req("PATCH", f"{table}?{where}", body, {"Prefer": "return=minimal"})


# ── 먹선 공개 API ─────────────────────────────────────────────────────────
def fetch_traffic_light(base: str, barcode: str) -> tuple[dict | None, str]:
    """GET /api/products/:barcode → (색 dict | None, 상태문자열). 무인증 공개 API."""
    url = f"{base}/api/products/{urllib.parse.quote(barcode)}"
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                data = json.loads(r.read().decode())
            nutrients = ((data or {}).get("traffic_light") or {}).get("nutrients") or {}

            def color(key: str):
                c = (nutrients.get(key) or {}).get("color")
                return c if c in VALID_COLORS else None   # 판정 외 값/결측 → null(안전 아님)

            return ({
                "barcode": barcode,
                "sodium_color": color("sodium"),
                "sugars_color": color("sugars"),
                "sat_fat_color": color("sat_fat"),
                "product_id": (data.get("product") or {}).get("product_id"),
                "source": "meokseon_api",
            }, "ok")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None, "not_found"        # 먹선에 없는 제품 — 재시도 무의미
            if attempt == RETRIES - 1:
                return None, f"http_{e.code}"
        except Exception as e:
            if attempt == RETRIES - 1:
                return None, f"error:{type(e).__name__}"
        time.sleep(0.5 * (attempt + 1))         # 지수 백오프
    return None, "exhausted"


# ── 실측 리포트 ───────────────────────────────────────────────────────────
def report(rest: Rest) -> dict:
    """IP/136 §1.8 미확인 항목을 실측으로 해소."""
    total = rest.count("scan_history")
    with_bc = rest.count("scan_history", "barcode=not.is.null")
    filled = rest.count("scan_history", "barcode=not.is.null&sodium_color=not.is.null")
    cached = rest.count("meokseon_tl_cache") if True else 0
    rate = (filled / with_bc) if with_bc else 0.0
    print("\n" + "=" * 58)
    print("실측 리포트 (IP/136 §1.8 미확인 항목 해소)")
    print("=" * 58)
    print(f"  ① scan_history 실 적재량      : {total:,} 행")
    print(f"     └ barcode 있는 행           : {with_bc:,} 행")
    print(f"  ② 색 채움 행                   : {filled:,} 행")
    print(f"  ③ 색 채움률                    : {rate:.1%}  (수용 기준 ≥ {FILL_RATE_TARGET:.0%})"
          f"  → {'✅ PASS' if rate >= FILL_RATE_TARGET else '❌ 미달'}")
    print(f"  ④ meokseon_tl_cache 캐시 제품   : {cached:,} 종")
    return {"total": total, "with_barcode": with_bc, "filled": filled, "fill_rate": rate, "cached": cached}


# ── 메인 ──────────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description="먹선 신호등 캐시 워밍 + scan_history 색 백필")
    ap.add_argument("--dry-run", action="store_true", help="쓰기 없이 실측·조회만")
    ap.add_argument("--report-only", action="store_true", help="채움률 리포트만 출력하고 종료")
    ap.add_argument("--limit", type=int, default=0, help="처리할 최대 바코드 수(0=전체)")
    args = ap.parse_args()

    rest = Rest(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))
    base = normalize_base(env("MEOKSEON_API_URL", required=not args.report_only))

    before = report(rest)
    if args.report_only:
        return 0

    # ── 1) 색이 비어 있는 행의 distinct barcode 수집 ──
    print("\n[1/3] 색 결측 행의 distinct barcode 수집...")
    barcodes: set[str] = set()
    offset = 0
    while True:
        rows = rest.select(
            f"scan_history?select=barcode&barcode=not.is.null&sodium_color=is.null"
            f"&limit={PAGE}&offset={offset}&order=barcode"
        )
        if not rows:
            break
        barcodes.update(r["barcode"] for r in rows if r.get("barcode"))
        if len(rows) < PAGE:
            break
        offset += PAGE
    todo = sorted(barcodes)
    if args.limit:
        todo = todo[: args.limit]
    print(f"  → 대상 고유 바코드 {len(todo):,} 종")
    if not todo:
        print("  → 백필할 대상이 없습니다. 종료.")
        return 0

    # ── 2) 먹선 공개 API 조회 → 캐시 upsert ──
    print(f"\n[2/3] 먹선 공개 API 조회 → meokseon_tl_cache upsert ({'DRY-RUN' if args.dry_run else '실행'})...")
    stats = Counter()
    cache_rows: list[dict] = []
    unmatched: list[str] = []
    for i, bc in enumerate(todo, 1):
        row, status = fetch_traffic_light(base, bc)
        stats[status] += 1
        if row:
            cache_rows.append(row)
            if row["sodium_color"] is None and row["sugars_color"] is None:
                stats["tl_all_null"] += 1      # 제품은 있으나 신호등 판정이 없음(§1.8 ④)
        else:
            unmatched.append(f"{bc}\t{status}")
        if i % 50 == 0:
            print(f"  {i:,}/{len(todo):,} ...")
        time.sleep(SLEEP_BETWEEN)

    match_rate = stats["ok"] / len(todo) if todo else 0.0
    print(f"\n  바코드 매칭률(§1.8 ③): {match_rate:.1%}  ({stats['ok']:,}/{len(todo):,})")
    for k, v in sorted(stats.items()):
        print(f"    {k:16s} {v:,}")

    if not args.dry_run and cache_rows:
        for i in range(0, len(cache_rows), 500):
            rest.upsert("meokseon_tl_cache", cache_rows[i : i + 500])
        print(f"  → 캐시 upsert {len(cache_rows):,} 종 완료")

    # ── 3) scan_history 색 UPDATE (색이 비어 있는 행만) ──
    print(f"\n[3/3] scan_history 색 백필 ({'DRY-RUN' if args.dry_run else '실행'})...")
    updated = 0
    if not args.dry_run:
        for row in cache_rows:
            body = {}
            if row["sodium_color"] is not None:
                body["sodium_color"] = row["sodium_color"]
            if row["sugars_color"] is not None:
                body["sugars_color"] = row["sugars_color"]
            if not body:
                continue   # 판정이 아예 없는 제품 → null 유지("판정 없음" ≠ 안전)
            bc = urllib.parse.quote(row["barcode"])
            # 이미 색이 있는 행은 건드리지 않는다 — "그때 사용자가 본 색"을 덮어쓰지 않기 위함.
            rest.patch("scan_history", f"barcode=eq.{bc}&sodium_color=is.null", body)
            updated += 1
        print(f"  → {updated:,} 종의 바코드에 대해 UPDATE 실행")
    else:
        print("  → DRY-RUN: 쓰기 생략")

    after = report(rest)

    if unmatched:
        path = "tools/data/meokseon_tl_unmatched.tsv"
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("barcode\tstatus\n" + "\n".join(unmatched) + "\n")
        print(f"\n  ⚠️ 미매칭 바코드 {len(unmatched):,}건 → {path}")

    ok = after["fill_rate"] >= FILL_RATE_TARGET
    print("\n" + "=" * 58)
    print(f"판정: 채움률 {before['fill_rate']:.1%} → {after['fill_rate']:.1%}  "
          f"{'✅ PASS' if ok else '❌ 미달 — 위 미매칭 목록 확인'}")
    print("=" * 58)
    print("\n주의: 채움률이 높다는 것은 '색을 가져왔다'는 뜻이지 '색이 옳다'는 뜻이 아닙니다.")
    print("      색의 정본은 먹선이며 이 잡은 그대로 스냅샷할 뿐 자체 임계를 만들지 않습니다.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
