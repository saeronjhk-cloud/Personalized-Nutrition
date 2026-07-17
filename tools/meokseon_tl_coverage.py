#!/usr/bin/env python3
"""
먹선 신호등 **커버리지 실측** — IP/145 §1 의 답을 n=3 이 아니라 제대로 낸다. (세션31)

── 왜 이 도구가 필요한가 ────────────────────────────────────────────────────
세션31 dry-run 실측: 고유 바코드 3종 → 매칭 100%(3/3) · traffic_light 전부 null.
"먹선이 제품은 아는데 색을 안 준다"는 방향은 잡혔지만 **표본이 3이다.**
IP/145 §1 은 "결측률이 높으면 먹선 축의 방향 자체를 다시 봐야 한다"고 했다.
축을 바꾸는 결정을 n=3 으로 내리면 세션30 §4(확인한 범위를 전체인 것처럼 말했다)의 반복이다.

→ 검색 엔드포인트로 수백 종을 표집해 **결측률을 신뢰구간과 함께** 낸다.

── 무엇을 재는가 ────────────────────────────────────────────────────────────
  ① traffic_light 자체가 있는 제품 비율
  ② sodium 색이 있는 제품 비율          ← MS_REPEAT_RED_SODIUM 이 발화할 수 있는 모집단
  ③ 색이 없을 때 nutrition.sodium **원수치**가 있는 비율
     → IP/145 §1 대안②("자체 판정")가 물리적으로 가능한지. 가능성과 허용은 다르다 —
        허용 여부는 임상/제품 결정이며 이 도구는 **가능성만** 잰다.
  ④ 카테고리별 분해 — 결측이 특정 분류에 몰렸는지

── 한계 (먼저 밝힌다) ───────────────────────────────────────────────────────
  · 검색어 기반 표집은 **무작위 표본이 아니다.** 먹선 검색 랭킹에 편향된다.
    "한국인이 실제로 스캔하는 제품"의 모집단과 다를 수 있다 → 방향 판단용이지 모수 추정 아님.
  · 읽기 전용. Supabase 에 쓰지 않고 먹선에 GET 만 한다.

실행:
  python tools/meokseon_tl_coverage.py                 # 기본 150종
  python tools/meokseon_tl_coverage.py --limit 400     # 더 넓게
  python tools/meokseon_tl_coverage.py --scan-audit    # scan_history 색 1건의 정체 확인(읽기 전용)
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

_spec = importlib.util.spec_from_file_location("bf", pathlib.Path(__file__).resolve().parent / "meokseon_tl_backfill.py")
bf = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(bf)

# 표집용 검색어 — 한국 가공식품에서 나트륨/당류가 실제로 문제되는 분류 위주.
TERMS = [
    "라면", "과자", "음료", "우유", "빵", "소시지", "햄", "김치", "참치", "두부",
    "요구르트", "초콜릿", "커피", "시리얼", "만두", "치즈", "주스", "아이스크림",
    "국", "찌개", "볶음밥", "피자", "너겟", "돈까스", "김", "젓갈", "장아찌", "소스",
    "간장", "된장", "고추장", "마요네즈", "케첩", "드레싱", "스프", "죽", "떡",
    "에너지바", "단백질음료", "탄산음료", "이온음료", "비스킷", "사탕", "젤리",
]


def wilson(k: int, n: int) -> tuple[float, float]:
    """Wilson 95% 신뢰구간. n 이 작을 때 정규근사보다 정직하다."""
    if n == 0:
        return (0.0, 0.0)
    z, p = 1.96, k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def get_json(url: str, timeout: int = 15):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def collect(base: str, limit: int) -> list[str]:
    seen: dict[str, str] = {}
    print(f"[1/2] 검색어 {len(TERMS)}종으로 바코드 표집 (목표 {limit}종)...")
    for t in TERMS:
        if len(seen) >= limit:
            break
        try:
            d = get_json(f"{base}/api/products/search?q={urllib.parse.quote(t)}&limit=30")
        except Exception as e:
            print(f"    · '{t}' 검색 실패({type(e).__name__}) — 건너뜀")
            continue
        for p in (d or {}).get("products", []):
            bc = (p.get("barcode") or "").strip()
            if bc and bc not in seen:
                seen[bc] = t
            if len(seen) >= limit:
                break
        time.sleep(0.15)
    print(f"  → 고유 바코드 {len(seen):,}종 확보")
    return list(seen.items())


def probe(base: str, pairs: list[tuple[str, str]]) -> dict:
    print(f"\n[2/2] 제품별 traffic_light 실측 ({len(pairs):,}건)...")
    st = Counter()
    by_term: dict[str, Counter] = defaultdict(Counter)
    n = tl_any = tl_sodium = tl_sugars = 0
    na_sodium_raw = na_sodium_missing = 0
    reds: list[tuple[str, str]] = []   # MS_REPEAT_RED_SODIUM 실증용 (barcode, 제품명)
    for i, (bc, term) in enumerate(pairs, 1):
        try:
            d = get_json(f"{base}/api/products/{urllib.parse.quote(bc)}")
        except urllib.error.HTTPError as e:
            st[f"http_{e.code}"] += 1; continue
        except Exception as e:
            st[f"error:{type(e).__name__}"] += 1; continue
        st["ok"] += 1
        n += 1
        nutrients = ((d or {}).get("traffic_light") or {}).get("nutrients") or {}
        def col(k):
            c = (nutrients.get(k) or {}).get("color")
            return c if c in bf.VALID_COLORS else None
        s, g = col("sodium"), col("sugars")
        if s == "red":
            reds.append((bc, ((d or {}).get("product") or {}).get("product_name") or "?"))
        has_any = bool(s or g or col("sat_fat"))
        tl_any += has_any; tl_sodium += bool(s); tl_sugars += bool(g)
        by_term[term]["n"] += 1
        by_term[term]["tl"] += has_any
        if not s:
            raw = ((d or {}).get("nutrition") or {}).get("sodium")
            if raw is None: na_sodium_missing += 1
            else: na_sodium_raw += 1
        if i % 25 == 0:
            print(f"    {i}/{len(pairs)}...")
        time.sleep(0.15)
    return dict(n=n, tl_any=tl_any, tl_sodium=tl_sodium, tl_sugars=tl_sugars,
                na_sodium_raw=na_sodium_raw, na_sodium_missing=na_sodium_missing,
                status=st, by_term=by_term, reds=reds)


def line(label: str, k: int, n: int) -> None:
    lo, hi = wilson(k, n)
    pct = (k / n * 100) if n else 0.0
    print(f"  {label:<38} {k:>4}/{n:<4} = {pct:5.1f}%   [95% CI {lo*100:4.1f}–{hi*100:4.1f}%]")


def scan_audit() -> None:
    """scan_history 의 색 1건이 무엇인지 확인 — 읽기 전용."""
    bf.load_dotenv()
    rest = bf.Rest(bf.env("SUPABASE_URL"), bf.env("SUPABASE_SERVICE_ROLE_KEY"))
    rows = rest.select("scan_history?select=barcode,product_name,scanned_at,sodium_color,sugars_color"
                       "&barcode=not.is.null&order=scanned_at.desc&limit=200")
    print("\n" + "=" * 66)
    print("scan_history 감사 — '색 있는 1건'의 정체 (IP/145 §1 미해결분)")
    print("=" * 66)
    filled = [r for r in rows if r.get("sodium_color") or r.get("sugars_color")]
    empty = [r for r in rows if not (r.get("sodium_color") or r.get("sugars_color"))]
    fb = {r["barcode"] for r in filled}
    eb = {r["barcode"] for r in empty}
    for r in filled:
        print(f"  [색 있음] {r['barcode']}  {r.get('product_name','')[:22]:<22} "
              f"sodium={r.get('sodium_color')} sugars={r.get('sugars_color')}  {r.get('scanned_at','')[:19]}")
    print(f"\n  색 있는 행 {len(filled)} · 색 없는 행 {len(empty)}")
    print(f"  색 있는 바코드 {len(fb)}종 · 색 없는 바코드 {len(eb)}종")
    both = fb & eb
    if both:
        print(f"  ★ 같은 바코드가 양쪽에 존재: {sorted(both)}")
        print("     → 같은 제품인데 어떤 스캔엔 색이 있고 어떤 스캔엔 없다.")
        print("       API 가 색을 잃었거나, 색 없는 행이 136 마이그레이션 **이전** 스캔이라는 뜻.")
        print("       (후자면 그 null 은 API 결측의 증거가 아니다 — 컬럼이 없던 시절의 행이다)")
    else:
        print("  → 색 있는 바코드와 없는 바코드가 겹치지 않는다.")
        print(f"     즉 제품 단위 커버리지는 {len(fb)}/{len(fb | eb)}종. 표본이 작으니 아래 실측을 볼 것.")


def main() -> int:
    ap = argparse.ArgumentParser(description="먹선 신호등 커버리지 실측(읽기 전용)")
    ap.add_argument("--limit", type=int, default=150, help="표집할 고유 바코드 수(기본 150)")
    ap.add_argument("--scan-audit", action="store_true", help="scan_history 색 1건의 정체 확인")
    args = ap.parse_args()

    bf.load_dotenv()
    if args.scan_audit:
        scan_audit()
    base = bf.normalize_base(bf.env("MEOKSEON_API_URL"))
    pairs = collect(base, args.limit)
    if not pairs:
        sys.exit("[중단] 표집 실패 — 검색 엔드포인트를 확인하세요.")
    r = probe(base, pairs)
    n = r["n"]

    print("\n" + "=" * 66)
    print("먹선 신호등 커버리지 실측 (IP/145 §1)")
    print("=" * 66)
    print(f"  조회 상태: {dict(r['status'])}")
    print()
    line("① traffic_light 있는 제품", r["tl_any"], n)
    line("② sodium 색 있는 제품", r["tl_sodium"], n)
    line("   sugars 색 있는 제품", r["tl_sugars"], n)
    print()
    miss = n - r["tl_sodium"]
    print(f"  ③ sodium 색이 없는 {miss}종 중:")
    line("     nutrition.sodium 원수치 있음", r["na_sodium_raw"], miss)
    line("     원수치조차 없음", r["na_sodium_missing"], miss)
    print("     ※ '원수치 있음' = IP/145 §1 대안②(자체 판정)가 **물리적으로 가능**하다는 뜻일 뿐이다.")
    print("        허용 여부는 별개다 — 자체 임계 금지 도크트린(web/src/lib/meokseon.ts:51)과")
    print("        정면 충돌하며 제품·임상 결정이다. 이 도구는 가능성만 잰다.")

    print("\n  ④ 검색어별 traffic_light 보유율 (표집 편향 있음 — 방향 참고용):")
    for t, c in sorted(r["by_term"].items(), key=lambda x: -x[1]["n"])[:14]:
        if c["n"]:
            print(f"     {t:<10} {c['tl']:>3}/{c['n']:<3} = {c['tl']/c['n']*100:5.1f}%")

    # ★ MS_REPEAT_RED_SODIUM 실증 경로 — 세션31 발견:
    #   이 코드의 태그는 sodium_reduction·food_swap 이고 둘 다 TAG_DATA_REQUIREMENTS 가 [] 다
    #   ("최소 subset: 프로파일이 없어도 안전한 액션(침묵 방지)", safety.ts:118-119).
    #   → user_safety_profiles 없이(=fail-closed 상태로) **유일하게 억제를 통과**하는 카드다.
    #   NL_* 는 전부 ED_SCREEN_TOOL_CONFIRMED=false 때문에 cannot_assess 로 죽는다.
    #   임계는 7일 내 red 3건(MS_RED_REPEAT_THRESHOLD_7D). 아래 제품을 3개 스캔하면 카드가 뜬다.
    print("\n" + "=" * 66)
    print(f"★ 나트륨 red 제품 {len(r['reds'])}종 — 첫 카드 실증용 (7일 내 3개 스캔 시 발화)")
    print("=" * 66)
    if r["reds"]:
        for bc, nm in r["reds"][:15]:
            print(f"  {bc:<16} {nm[:38]}")
        if len(r["reds"]) < 3:
            print(f"\n  ⚠️ {len(r['reds'])}종뿐 — 임계 3건에 미달. --limit 을 올려 더 표집하세요.")
    else:
        print("  ★ 0종. 이 표본에선 나트륨 red 판정을 받은 제품이 없다.")
        print("     → MS_REPEAT_RED_SODIUM 은 실데이터로 실증 불가.")
        print("       카드를 보려면 서박사 안전문항 확정(NL_* 해금)이 유일한 길이다.")

    print("\n" + "=" * 66)
    rate = r["tl_sodium"] / n if n else 0
    lo, hi = wilson(r["tl_sodium"], n)
    print(f"판정 재료: sodium 색 보유율 {rate:.1%} (95% CI {lo:.1%}–{hi:.1%}, n={n})")
    print("  → MS_REPEAT_RED_SODIUM 이 발화할 수 있는 모집단이 이만큼이다.")
    print("  ⚠️ 검색어 기반 표집은 무작위가 아니다. 모수 추정이 아니라 **방향 판단**용이다.")
    print("  ⚠️ 이 숫자는 '색이 없다'만 말한다. '색이 옳다'는 여전히 먹선 정본의 문제다.")
    print("=" * 66)
    return 0


if __name__ == "__main__":
    sys.exit(main())
