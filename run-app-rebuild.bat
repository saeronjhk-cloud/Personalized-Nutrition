@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
REM ============================================================================
REM  run-app-rebuild.bat — 안드로이드 앱 재빌드 (세션52 · 2026-09-03)
REM ============================================================================
REM  왜 지금 재빌드해야 하나 — 커밋만 되고 «실기기에서 확인된 적 없는» 것이 3개다:
REM    701008b  숫자 코드 로그인 (otpCode / postLogin / LoginEmail / AuthCallback)
REM    24a3018  CAMERA 권한 선언 — 앱 바코드 스캔이 최초 설정 이래 «불가능»했다
REM    (세션52) 구별 불가 쌍 정정 칩 (foodCorrection / MealResult / Meal)
REM
REM  ⚠ 앞의 둘은 «앱에서만» 안 되던 것이다. 웹에서는 멀쩡했다 — 규칙67.
REM     그래서 PC 브라우저 테스트로는 절대 검증되지 않는다. 실기기여야 한다.
REM
REM  ⛔ 이 스크립트는 빌드까지만 한다. 설치·확인은 사람이 한다.
REM     확인 항목은 IP\OUTSTANDING_앱재빌드_체크리스트.md 에 있다.
REM ============================================================================

set ROOT=D:\서박사의 영양공식
set WEB=%ROOT%\web

echo.
echo ============================================================
echo  0. 사전 점검 — 소스에 세 변경분이 «실제로» 있는가
echo ============================================================
REM  「커밋했다」와 「이 워킹트리에 있다」는 다른 사건이다(규칙66 의 형태).
REM  없는 채로 30분짜리 빌드를 돌리는 사고를 여기서 막는다.
set MISSING=0

if not exist "%WEB%\src\lib\otpCode.ts" (
  echo   [X] src\lib\otpCode.ts 없음 — 코드 로그인 미반영
  set MISSING=1
) else ( echo   [O] otpCode.ts )

if not exist "%WEB%\src\lib\postLogin.ts" (
  echo   [X] src\lib\postLogin.ts 없음 — 로그인 직후 작업 공통화 미반영
  set MISSING=1
) else ( echo   [O] postLogin.ts )

if not exist "%WEB%\src\lib\foodCorrection.ts" (
  echo   [X] src\lib\foodCorrection.ts 없음 — 정정 칩 미반영
  set MISSING=1
) else ( echo   [O] foodCorrection.ts )

findstr /C:"android.permission.CAMERA" "%WEB%\android\app\src\main\AndroidManifest.xml" > nul
if errorlevel 1 (
  echo   [X] AndroidManifest 에 CAMERA 권한 없음 — 바코드 스캔이 또 안 된다
  set MISSING=1
) else ( echo   [O] CAMERA 권한 선언 )

REM  세션52 — JDK 21. Capacitor 8 이 sourceCompatibility 21 을 요구하는데
REM  시스템 java 는 17 이라 gradlew 가 `invalid source release: 21` 로 죽었다.
REM  gradle.properties 의 org.gradle.java.home 이 Android Studio 내장 JBR 21 을 가리킨다.
REM  Android Studio 를 옮기거나 지우면 그 경로가 죽고 다시 같은 실패가 난다 — 여기서 먼저 잡는다.
if not exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
  echo   [X] JDK 21 없음: C:\Program Files\Android\Android Studio\jbr
  echo       gradle.properties 의 org.gradle.java.home 이 이 경로를 가리킨다.
  echo       Android Studio 를 옮겼거나 지웠으면 그 파일의 경로를 고칠 것.
  set MISSING=1
) else ( echo   [O] JDK 21 ^(Android Studio JBR^) )

if "!MISSING!"=="1" (
  echo.
  echo   ^>^> 빌드를 중단한다. 위 항목을 먼저 확인할 것.
  echo      브랜치가 바뀌었거나 pull 이 안 된 상태일 수 있다.
  goto :end
)

echo.
echo ============================================================
echo  1. 테스트 — 깨진 채로 빌드하지 않는다
echo ============================================================
cd /d "%WEB%"
call npx tsc --noEmit
if errorlevel 1 ( echo   ^>^> 타입 오류. 중단한다. & goto :end )
echo   [O] tsc 통과

call npm test
if errorlevel 1 ( echo   ^>^> 테스트 실패. 중단한다. & goto :end )
echo   [O] 테스트 통과

echo.
echo ============================================================
echo  2. 웹 번들 빌드
echo ============================================================
call npm run build
if errorlevel 1 ( echo   ^>^> 빌드 실패. 중단한다. & goto :end )

echo.
echo ============================================================
echo  3. Capacitor 동기화 — dist 를 안드로이드 프로젝트로 복사
echo ============================================================
REM  ⚠ 이 단계를 빠뜨리면 «옛 웹 번들이 든» APK 가 나온다. 빌드는 성공하고
REM    앱은 예전 화면을 보여준다. 가장 헷갈리는 실패 형태다.
call npx cap sync android
if errorlevel 1 ( echo   ^>^> cap sync 실패. 중단한다. & goto :end )

echo.
echo ============================================================
echo  4. APK 빌드 (debug)
echo ============================================================
cd /d "%WEB%\android"
call gradlew.bat assembleDebug
if errorlevel 1 ( echo   ^>^> gradle 실패. 위 로그를 볼 것. & goto :end )

echo.
echo ============================================================
echo  완료
echo ============================================================
echo   APK: %WEB%\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo   설치:  adb install -r "%WEB%\android\app\build\outputs\apk\debug\app-debug.apk"
echo.
echo   ⚠ 여기서 끝이 아니다. 실기기에서 확인할 것:
echo      IP\OUTSTANDING_앱재빌드_체크리스트.md
echo.

:end
cd /d "%ROOT%"
endlocal
pause
