@echo off
REM ======================================================================
REM  Run-to-run variance measurement.   (session 49, 2026-08-28)
REM
REM  100%% ASCII, CRLF.
REM
REM  COST: about $0.48  (3 runs x 32 photos).
REM
REM  ---------------------------------------------------------------------
REM  WHY THIS EXISTS
REM  ---------------------------------------------------------------------
REM  2026-08-28 measurement:
REM      raw         (2026-08-23)   EXACT 19/32 = 59.4%%
REM      production  (2026-08-28)   EXACT 20/32 = 62.5%%
REM
REM  That looks like production preprocessing WINS.  It does not.
REM  Only 3 photos out of 32 changed verdict, and they moved BOTH ways:
REM      johgi-gui      NONE  -> EXACT
REM      jjukkumi       EXACT -> NONE
REM      cafe latte     LOOSE -> EXACT   ("latte" -> "cafe latte")
REM  Net gain: ONE photo.
REM
REM  We do not know how much GPT-4o wobbles when you run the SAME
REM  condition twice.  Until we know that, a 1-photo difference means
REM  nothing.  This script measures the wobble.
REM
REM  ---------------------------------------------------------------------
REM  WHAT IT DOES
REM  ---------------------------------------------------------------------
REM    STEP 1   raw        --tag run2     (second raw sample)
REM    STEP 2   raw        --tag run3     (third raw sample)
REM    STEP 3   production --tag run2     (second production sample)
REM    STEP 4   compare_runs.py           (free, no API)
REM
REM  Together with the two existing files that gives raw n=3,
REM  production n=2.
REM
REM  ---------------------------------------------------------------------
REM  WHAT MUST NOT HAPPEN
REM  ---------------------------------------------------------------------
REM  Every run carries --tag, so results land in SEPARATE files:
REM      .tmp\photo_test_results_run2.json
REM      .tmp\photo_test_results_run3.json
REM      .tmp\photo_test_results_production_run2.json
REM  The 59.4%% baseline file (photo_test_results.json) is NOT touched.
REM  Without --tag, step 1 would overwrite it and the baseline identity
REM  every IP document depends on would be gone.
REM
REM  ---------------------------------------------------------------------
REM  WHAT TO LOOK AT
REM  ---------------------------------------------------------------------
REM  STEP 4 prints the verdict.  If the gap between conditions falls
REM  inside the spread WITHIN the raw condition, the honest answer is
REM  "cannot tell them apart" - and that is a real result, not a failure.
REM ======================================================================

cd /d "%~dp0backends\NutriLens"
if errorlevel 1 goto :nodir

if not exist "tools\accuracy_test.py" goto :noscript
if not exist "tools\compare_runs.py" goto :nocompare

echo.
echo ######################################################################
echo #  Run-to-run variance:  3 runs, about $0.48 total                   #
echo ######################################################################
echo.
echo  This does NOT touch the 59.4%% baseline file.
echo  Each run writes its own tagged file.
echo.
echo  Press Ctrl+C now if you do not want to spend $0.48.
echo.
pause

echo.
echo ###### STEP 1 / 4  -  raw, sample 2  (about $0.16) ######
echo.
python -u tools\accuracy_test.py --photo --set baseline32 --preprocess raw --tag run2
if errorlevel 1 goto :runfail

echo.
echo ###### STEP 2 / 4  -  raw, sample 3  (about $0.16) ######
echo.
python -u tools\accuracy_test.py --photo --set baseline32 --preprocess raw --tag run3
if errorlevel 1 goto :runfail

echo.
echo ###### STEP 3 / 4  -  production, sample 2  (about $0.16) ######
echo.
python -u tools\accuracy_test.py --photo --set baseline32 --preprocess production --tag run2
if errorlevel 1 goto :runfail

echo.
echo ###### STEP 4 / 4  -  variance summary  (free, no API) ######
echo.
REM  Explicit file list - NOT a glob.  A glob also matches the _archive()
REM  backups (photo_test_results_2026-07-24.json etc), which are older code
REM  versions and in one case a byte-identical duplicate.  Feeding those in
REM  inflates the "spread within raw" and pushes the verdict toward
REM  "cannot tell apart" no matter what.  Measured 2026-08-28: glob gave
REM  raw n=6 instead of n=3.
python -u tools\compare_runs.py ".tmp/photo_test_results.json" ".tmp/photo_test_results_run2.json" ".tmp/photo_test_results_run3.json" ".tmp/photo_test_results_production.json" ".tmp/photo_test_results_production_run2.json"
if errorlevel 1 goto :cmpfail

echo.
echo ======================================================================
echo  DONE.  Five result files now exist under .tmp\ :
echo    photo_test_results.json                  raw   sample 1 (baseline)
echo    photo_test_results_run2.json             raw   sample 2
echo    photo_test_results_run3.json             raw   sample 3
echo    photo_test_results_production.json       prod  sample 1
echo    photo_test_results_production_run2.json  prod  sample 2
echo.
echo  Just tell Claude it finished - Claude reads them directly.
echo ======================================================================
goto :end

:nodir
echo.
echo  [STOP] Could not enter backends\NutriLens - is this .bat in the project root?
goto :end

:noscript
echo.
echo  [STOP] tools\accuracy_test.py not found.
goto :end

:nocompare
echo.
echo  [STOP] tools\compare_runs.py not found.
echo         It was added in session 49.  Ask Claude to create it.
goto :end

:runfail
echo.
echo  [STOP] A measurement run failed - see the message above.
echo         Nothing further was run.  Do NOT quote partial results:
echo         check the "usable" field inside any file that was written.
goto :end

:cmpfail
echo.
echo  [STOP] The three runs finished but the comparison failed.
echo         The result files are fine - only the summary step broke.
echo         Tell Claude; the files can be read directly.
goto :end

:end
echo.
pause
