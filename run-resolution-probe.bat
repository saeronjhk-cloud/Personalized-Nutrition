@echo off
chcp 65001 > nul
REM ============================================================================
REM  run-resolution-probe.bat — 해상도 프로브 (세션52 · 2026-09-03)   $0
REM ============================================================================
REM  v5 1280 재학습에 «값어치가 있는지»를 학습 전에 값싸게 떠본다.
REM  v4 가중치는 그대로 두고 «추론» 해상도만 640↔1280 으로 바꿔 같은 사진을 다시 본다.
REM
REM  ★ 결과 해석이 비대칭이다. 반드시 알고 볼 것:
REM     혼동이 줄어든다   → 해상도 가설에 유리. 재학습할 값어치가 있다.
REM     아무것도 안 변한다 → «약한» 반증일 뿐이다. 재학습을 기각하지 마라.
REM                          640 으로 학습된 특징만 보고 있기 때문이다.
REM
REM  GPU 가 없으면 CPU 로도 돈다(느리다. 300장이면 몇 분~십수 분).
REM  1280 은 640 보다 4배쯤 걸린다.
REM ============================================================================

cd /d "D:\서박사의 영양공식\backends\NutriLens"

if not exist "models\food30_detection_v4.pt" (
  echo   [X] models\food30_detection_v4.pt 가 없다. 중단한다.
  goto :end
)
if not exist "..\..\.tmp\food30\images\val" (
  if not exist "D:\서박사의 영양공식\.tmp\food30\images\val" (
    echo   [X] .tmp\food30\images\val 이 없다.
    echo       ⚠ v4 학습 데이터가 통째로 사라졌다는 뜻이다. 재학습도 불가능하다.
    goto :end
  )
)

python tools\food30_resolution_probe.py "D:\서박사의 영양공식" --limit 300

:end
echo.
pause
