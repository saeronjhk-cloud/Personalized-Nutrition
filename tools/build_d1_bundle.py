#!/usr/bin/env python3
"""
D-1 적용 번들 생성기 — 제이가 Supabase SQL Editor 에 **한 번만** 붙여넣도록 4개를 묶는다.

★ 왜 생성물인가: 정본을 복사해두면 표류한다. 세션30 이 GI 표 사본이 정본을 가려
  "IP 만 고쳤는데 엔진이 낡은 사본을 쓰면서 조용히 성공하는 침묵 함정"을 겪었다(IP/145 §5.3).
  → 이 스크립트는 **매번 정본에서 읽고** 각 소스의 SHA-256 을 헤더에 박는다.
    번들은 .tmp/ 에 떨어진다(일회용). 정본은 아래 4곳뿐이다.

실행: python tools/build_d1_bundle.py
출력: .tmp/d1_apply.sql  → Supabase Dashboard > SQL Editor 에 붙여넣고 Run (IP/143 STEP 2 절차)
"""
from __future__ import annotations
import hashlib, io, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MH = ROOT / "backends" / "Vita50" / "code" / "myhealthcheck" / "supabase" / "migrations"

# ★ 순서가 계약이다. 147 은 앞의 3개가 만든 것에 의존하지 않지만(뷰는 meal_log·survey_responses 만
#   본다), 레지스트리·테이블이 먼저 있어야 readiness 가 한 번에 통과한다.
SOURCES = [
    (MH / "20260714120000_p0_orchestrator.sql",         "오케스트레이터 4테이블 + 레지스트리 시드"),
    (MH / "20260714130000_orchestrator_loader_seam.sql", "profiles.timezone + user_safety_profiles"),
    (MH / "20260714140000_safety_profile_onboarding.sql","user_safety_profiles 확장 + 동의 함수"),
    (ROOT / "IP" / "147_d1_seam_v1.sql",                 "D-1 이음매: meals·characters 뷰(세션31)"),
]


def main() -> int:
    missing = [p for p, _ in SOURCES if not p.exists()]
    if missing:
        sys.exit("[중단] 정본 미발견:\n  " + "\n  ".join(str(m) for m in missing))

    parts, head = [], []
    for p, why in SOURCES:
        raw = io.open(p, encoding="utf-8").read()
        h = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
        head.append(f"--   {p.name:<48} {h}  {why}")
        parts.append(f"\n\n-- {'=' * 74}\n-- ▼ {p.name}\n-- {'=' * 74}\n{raw}")

    out = ROOT / ".tmp" / "d1_apply.sql"
    out.parent.mkdir(exist_ok=True)
    banner = (
        "-- " + "=" * 74 + "\n"
        "-- D-1 적용 번들 — **생성물이다. 이 파일을 고치지 마라.**\n"
        "--   정본을 고치고 `python tools/build_d1_bundle.py` 로 다시 만든다.\n"
        "--   (사본을 손으로 고치면 정본과 갈라진다 — IP/145 §5.3 GI 표 사고)\n"
        "--\n"
        "-- 적용: Supabase Dashboard > SQL Editor > New query > 전체 붙여넣기 > Run\n"
        "--       대상 프로젝트: 영양공식 (lrnuqhpgyuizfggxgxpl)\n"
        "--       전부 멱등이다. 두 번 돌려도 안전하다.\n"
        "--\n"
        "-- 소스 정본 (SHA-256 앞 16자):\n" + "\n".join(head) + "\n"
        "--\n"
        "-- 적용 후 검증: python tools/orchestrator_readiness.py  → 9테이블 전부 OK 기대\n"
        "-- " + "=" * 74 + "\n"
    )
    io.open(out, "w", encoding="utf-8", newline="\n").write(banner + "".join(parts) + "\n")
    print(f"생성: {out}")
    print(f"  {len(SOURCES)}개 정본 · {out.stat().st_size:,} bytes")
    for line in head:
        print("  " + line[3:])

    # ★ [세션31 사고] 처음엔 `Get-Content .tmp\d1_apply.sql -Raw | Set-Clipboard` 를 안내했다가
    #   라이브 SQL Editor 에서 42601 이 났다. PowerShell 5.1 의 Get-Content 는 -Encoding 이 없으면
    #   UTF-8 파일을 **시스템 ANSI(한국어 Windows = cp949)** 로 읽는다 → 한글이 mojibake 가 되고
    #   그 과정에서 작은따옴표 구조가 무너져 SQL 이 깨진다
    #   ('나트륨 red 제품 반복 → 저나트륨 대체' → '?샘듞瑜?red ... 泥?,'v1'  → syntax error).
    #   → 안내문을 사람이 외우게 두지 않는다. **빌더가 정확한 명령을 찍는다.**
    #   ReadAllText + 명시적 UTF8 인코딩은 PowerShell 5.1/7 양쪽에서 동일하게 안전하다.
    win = str(out).replace("/", "\\")
    print("\n" + "=" * 74)
    print("1) 클립보드로 복사 — 아래를 그대로 붙여넣으세요 (한 줄):")
    print("=" * 74)
    print(f'[IO.File]::ReadAllText("{win}", [Text.Encoding]::UTF8) | Set-Clipboard')
    print("=" * 74)
    print("   ⚠️ `Get-Content -Raw | Set-Clipboard` 는 쓰지 마세요 — PowerShell 5.1 이")
    print("      UTF-8 을 cp949 로 읽어 한글을 깨뜨리고 SQL 이 42601 로 죽습니다.")
    print("      (-Encoding UTF8 을 줘도 되지만 위 방식이 버전 무관하게 확실합니다.)")
    print("\n2) Supabase Dashboard > 영양공식 > SQL Editor > New query > Ctrl+V > Run")
    print("3) 검증: python tools\\orchestrator_readiness.py   → 9테이블 전부 OK 기대")
    return 0


if __name__ == "__main__":
    sys.exit(main())
