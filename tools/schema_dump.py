#!/usr/bin/env python3
"""
영양공식 스키마 덤프 — PostgREST OpenAPI 루트에서 테이블·컬럼을 **실측**한다. (세션31, 읽기 전용)

── 왜 ──────────────────────────────────────────────────────────────────────
D-1(오케스트레이터 이관)을 짜려면 대상 DB 의 실제 컬럼을 알아야 한다.
loaders.ts:164 는 MealRow 를 "public.meals 행(**확인된 실 컬럼**)" 이라 적어뒀지만
그건 **Vita50 DB** 에서 확인한 것이다. 영양공식엔 meals 가 없고 meal_log 가 있으며
(IP/116 이 파기하는 실명), 그 컬럼은 이 리포 어디에도 정의돼 있지 않다.

스키마를 추정해서 뷰를 짜면 배포 후에 42703 으로 죽는다. **묻는다.**
PostgREST 루트(GET /rest/v1/)가 OpenAPI 로 전체 테이블·컬럼을 준다 — 요청 1번.

실행:
  python tools/schema_dump.py                 # 오케스트레이터 관련 테이블만
  python tools/schema_dump.py --all           # 전체 테이블 이름
  python tools/schema_dump.py --table meal_log
"""
from __future__ import annotations
import argparse, importlib.util, json, pathlib, sys, urllib.request

_s = importlib.util.spec_from_file_location("bf", pathlib.Path(__file__).resolve().parent / "meokseon_tl_backfill.py")
bf = importlib.util.module_from_spec(_s); _s.loader.exec_module(bf)

# D-1 에 관련된 것들 — loaders.ts 계약 + 영양공식 meal 실명(IP/116) + 오케스트레이터 산출
FOCUS = [
    "profiles", "characters", "meals", "meal_log", "meal_log_adjustment", "meal_session",
    "analysis_job", "weekly_report", "meal_consent", "scan_history", "user_safety_profiles",
    "reason_code_registry", "action_candidates", "orchestrator_decisions", "action_events",
    "survey_responses", "anon_sessions", "app_event",
]


def fetch_spec(url: str, key: str) -> dict:
    req = urllib.request.Request(f"{url.rstrip('/')}/rest/v1/", method="GET")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Accept", "application/openapi+json")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def fetch_rows(url: str, key: str, table: str, limit: int = 20) -> list:
    req = urllib.request.Request(f"{url.rstrip('/')}/rest/v1/{table}?select=*&limit={limit}", method="GET")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def tables(spec: dict) -> dict[str, dict]:
    # PostgREST 는 버전에 따라 definitions(swagger2) 또는 components.schemas(oas3)
    d = spec.get("definitions")
    if not d:
        d = (spec.get("components") or {}).get("schemas") or {}
    return d


def main() -> int:
    ap = argparse.ArgumentParser(description="영양공식 스키마 실측(읽기 전용)")
    ap.add_argument("--all", action="store_true", help="전체 테이블 이름만 나열")
    ap.add_argument("--table", help="특정 테이블 컬럼 상세")
    ap.add_argument("--sample", help="실행: 그 테이블의 실제 1행에서 jsonb **키**를 뽑는다(값은 안 찍음)")
    args = ap.parse_args()

    bf.load_dotenv()
    url = bf.env("SUPABASE_URL")
    if not args.sample:
        spec = fetch_spec(url, bf.env("SUPABASE_SERVICE_ROLE_KEY"))
        t = tables(spec)
    else:
        t = {}
    print("=" * 72)
    print(f"영양공식 스키마 실측 — {url}" + (f"   (테이블 {len(t)}개)" if t else ""))
    print("=" * 72)

    if args.all:
        for name in sorted(t):
            print(f"  {name}")
        return 0

    if args.sample:
        # ★ 왜 필요한가: TypeScript 인터페이스는 **런타임 jsonb 를 구속하지 않는다.**
        #   nutrilens.ts:11 MealFood 에 gi 가 없다고 해서 meal_log.foods[] 에 gi 가 없는 건 아니다.
        #   선언이 아니라 **데이터**를 본다. 값은 출력하지 않는다(개인정보) — 키만.
        rows = fetch_rows(url, bf.env("SUPABASE_SERVICE_ROLE_KEY"), args.sample)
        print(f"\n[{args.sample}] 실제 행 {len(rows)}건에서 jsonb 키 추출 (★값은 출력 안 함)")
        if not rows:
            print("  행 없음 — 표본이 없어 판정 불가.")
            return 0
        for col in sorted(rows[0].keys()):
            vals = [r.get(col) for r in rows]
            if any(isinstance(v, (dict, list)) for v in vals):
                keys, n_items = set(), 0
                for v in vals:
                    if isinstance(v, dict):
                        keys |= set(v.keys())
                    elif isinstance(v, list):
                        for it in v:
                            n_items += 1
                            if isinstance(it, dict):
                                keys |= set(it.keys())
                kind = "배열 원소" if any(isinstance(v, list) for v in vals) else "객체"
                print(f"  {col:<22} [{kind}{f', {n_items}개' if n_items else ''}] 키: {sorted(keys)}")
        return 0

    want = [args.table] if args.table else FOCUS
    for name in want:
        if name not in t:
            print(f"\n[{name}]  ★ 없음")
            continue
        props = (t[name] or {}).get("properties") or {}
        req = set((t[name] or {}).get("required") or [])
        print(f"\n[{name}]  컬럼 {len(props)}개")
        for col, meta in props.items():
            typ = meta.get("format") or meta.get("type") or "?"
            pk = "PK" if "primary key" in str(meta.get("description", "")).lower() else ""
            nn = "NOT NULL" if col in req else ""
            print(f"    {col:<26} {typ:<14} {pk:<3} {nn}")
    print("\n" + "=" * 72)
    print("※ OpenAPI 는 **PostgREST 가 노출하는 것**만 보여준다(public 스키마·권한 범위).")
    print("  제약·트리거·RLS 정책 내용은 여기 안 나온다. 그건 별도 확인.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except bf.RestError as e:
        sys.exit(str(e))
