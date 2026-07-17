#!/usr/bin/env python3
"""
오케스트레이터 실행 준비도 실측 — "N9′ 카드를 붙일 수 있는가" 의 선결 질문. (세션31, 읽기 전용)

── 왜 ──────────────────────────────────────────────────────────────────────
IP/145 §2 는 D-1(오케스트레이터를 영양공식으로 이관)을 "✅ 완료"로 적었다.
그런데 loaders.ts 가 읽는 테이블(profiles·characters·meals·user_safety_profiles)이
web/supabase/ 사본에 **하나도 없다**(scan_history 만 있다).

**사본이 없다고 라이브에 없다는 증거는 아니다.** 제이가 직접 적용했을 수도 있다.
문서와 실측이 갈릴 때는 추정하지 않고 **DB 에 직접 묻는다.**

N9′ 카드 UI 를 붙이기 전에 답해야 한다 — 엔진에 입력이 없으면 빈 카드를 붙이는 것이다.

실행: python tools/orchestrator_readiness.py      (.env 자동 로드, 쓰기 없음)
"""
from __future__ import annotations
import importlib.util, pathlib, sys, urllib.error, urllib.request

_s = importlib.util.spec_from_file_location("bf", pathlib.Path(__file__).resolve().parent / "meokseon_tl_backfill.py")
bf = importlib.util.module_from_spec(_s); _s.loader.exec_module(bf)

# loaders.ts 가 실제로 읽는 테이블 → 없으면 그 producer 가 굶는다
INPUTS = [
    ("profiles",             "loadTimezone",      "타임존 — 없으면 로컬 날짜 창 계산 불가"),
    ("characters",           "loadGoals",         "목표 — features 의 goal 축"),
    ("meals",                "loadMeals",         "NutriLens 식사 → NL_* 사실"),
    ("scan_history",         "loadScans7d",       "먹선 스캔 → MS_* 사실"),
    ("user_safety_profiles", "loadSafetyProfile", "안전 게이트 — 없으면 차단 판정 불가"),
]
# 오케스트레이터가 쓰는 테이블(20260714120000_p0_orchestrator.sql)
# ★ 이름을 추측하지 않는다. 20260714120000_p0_orchestrator.sql 의 create table 실측:
OUTPUTS = ["reason_code_registry", "action_candidates", "orchestrator_decisions", "action_events"]


def probe(rest, table):
    """(존재?, 행수). 42P01 = 테이블 없음."""
    try:
        return True, rest.count(table)
    except SystemExit as e:
        m = str(e)
        if "42P01" in m or "does not exist" in m:
            return False, 0
        raise


def main() -> int:
    bf.load_dotenv()
    url = bf.env("SUPABASE_URL")
    rest = bf.Rest(url, bf.env("SUPABASE_SERVICE_ROLE_KEY"))
    print("=" * 70)
    print(f"오케스트레이터 준비도 — {url}")
    print("=" * 70)

    print("\n[입력] loaders.ts 가 읽는 테이블")
    missing_in = []
    for t, fn, why in INPUTS:
        ok, n = probe(rest, t)
        mark = f"{n:,} 행" if ok else "★ 테이블 없음"
        print(f"  {'OK  ' if ok else 'MISS'} {t:<22} {mark:<14} {fn:<18} {why}")
        if not ok:
            missing_in.append(t)

    print("\n[출력] 오케스트레이터가 쓰는 테이블")
    missing_out = []
    for t in OUTPUTS:
        ok, n = probe(rest, t)
        print(f"  {'OK  ' if ok else 'MISS'} {t:<22} {(f'{n:,} 행' if ok else '★ 테이블 없음')}")
        if not ok:
            missing_out.append(t)

    print("\n[먹선 축 입력 품질]")
    try:
        tot = rest.count("scan_history")
        col = rest.count("scan_history", "sodium_color=not.is.null")
        red = rest.count("scan_history", "sodium_color=eq.red")
        print(f"  scan_history {tot:,} 행 · sodium_color 있음 {col:,} · red {red:,}")
        print(f"  → MS_REPEAT_RED_SODIUM 임계 3건. 현재 red {red}건 → "
              f"{'발화 가능' if red >= 3 else '미발화(설계대로)'}")
    except SystemExit as e:
        print(f"  (스캔 품질 조회 실패: {str(e).splitlines()[0]})")

    print("\n" + "=" * 70)
    if missing_in or missing_out:
        print("판정: ★ 오케스트레이터는 이 프로젝트에서 **돌 수 없다**")
        if missing_in:
            print(f"  입력 누락: {missing_in}  → 해당 producer 는 사실을 못 만든다")
        if missing_out:
            print(f"  출력 누락: {missing_out}  → persist 단계에서 42P01 로 죽는다")
        print("\n  → IP/145 §2 의 'D-1 완료'는 **P0-1(먹선 색 스냅샷)만** 완료라는 뜻이고,")
        print("    오케스트레이터 본체 이관은 남아 있다는 실측 근거다.")
        print("    N9′ 카드 UI 는 이걸 먼저 해결해야 붙는다 — 지금 붙이면 빈 카드다.")
    else:
        print("판정: 테이블은 전부 있다. 카드가 비는지는 입력 행수를 볼 것.")
    print("\n⚠️ 이 스크립트는 '테이블이 있다'만 본다. RLS·트리거·레지스트리 내용은 안 본다.")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
