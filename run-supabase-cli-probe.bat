@echo off
chcp 65001 > nul
setlocal EnableExtensions
REM ============================================================================
REM  run-supabase-cli-probe.bat — Supabase CLI «TransportError» 원인 분리 (세션55)   $0
REM ============================================================================
REM  IP/179 §2-0: `supabase functions deploy` 가 TransportError 로 2회 실패, 대시보드로 우회.
REM  운영 함수는 «건드리지 않는다». 1줄짜리 프로브 함수 zz-cli-probe 를 4가지 조합으로
REM  배포해 보고, 끝나면 삭제한다.
REM     T1  CLI 2.115.0(당시 버전) · 한글 경로   ← 재현
REM     T2  CLI 2.115.0            · ASCII 경로  ← 경로 가설
REM     T3  CLI latest             · 한글 경로   ← 버전 가설
REM     T4  CLI latest             · ASCII 경로
REM  로그: .tmp\sb_cli_probe.log  (토큰이 찍힐 수 있는 줄은 걸러서 저장)
REM ============================================================================
set REF=lrnuqhpgyuizfggxgxpl
set ROOT=D:\서박사의 영양공식
set KR=%ROOT%\.tmp\sbprobe_kr
set EN=C:\sbprobe
set RAW=%TEMP%\sb_cli_probe_raw.log
set LOG=%ROOT%\.tmp\sb_cli_probe.log

if not exist "%KR%\supabase\functions\zz-cli-probe\index.ts" (
  echo   [X] 프로브 함수 파일이 없다: %KR%
  goto :end
)
xcopy /E /I /Y /Q "%KR%\supabase" "%EN%\supabase" > nul

> "%RAW%" echo ===== 환경 =====
>>"%RAW%" ver
>>"%RAW%" 2>&1 node -v
>>"%RAW%" 2>&1 where supabase
>>"%RAW%" 2>&1 echo HTTPS_PROXY=%HTTPS_PROXY% HTTP_PROXY=%HTTP_PROXY%
>>"%RAW%" 2>&1 docker version --format "{{.Server.Version}}"

call :t T1 2.115.0 "%KR%"
call :t T2 2.115.0 "%EN%"
call :t T3 latest  "%KR%"
call :t T4 latest  "%EN%"

echo.
echo   프로브 함수 삭제 중...
cd /d "%EN%"
>>"%RAW%" echo ===== 삭제 =====
call npx --yes supabase@latest functions delete zz-cli-probe --project-ref %REF% --yes >>"%RAW%" 2>&1
set EC=%ERRORLEVEL%
>>"%RAW%" echo [delete] exit=%EC%

findstr /V /I /C:"authorization" /C:"bearer" /C:"sbp_" /C:"apikey" "%RAW%" > "%LOG%"
del "%RAW%" > nul 2>&1
rmdir /S /Q "%EN%" > nul 2>&1
echo.
echo   끝. 로그: %LOG%
echo   Claude 에게 「끝났다」고만 알려 주시면 로그를 직접 읽습니다.
goto :end

:t
echo   %1  CLI %2  %~3 ...
cd /d %3
>>"%RAW%" echo.
>>"%RAW%" echo ===== %1  CLI %2  %~3 =====
>>"%RAW%" 2>&1 call npx --yes supabase@%2 --version
call npx --yes supabase@%2 functions deploy zz-cli-probe --project-ref %REF% --debug >>"%RAW%" 2>&1
set EC=%ERRORLEVEL%
>>"%RAW%" echo [%1] exit=%EC%
echo      exit=%EC%
exit /b 0

:end
echo.
pause
