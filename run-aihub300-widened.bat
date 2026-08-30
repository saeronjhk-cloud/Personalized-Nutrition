@echo off
REM ======================================================================
REM  AI Hub holdout re-run AFTER the session-50 category widening.
REM  30 classes x 10 photos = 300.   100%% ASCII, CRLF.
REM
REM  COST: about $1.50.  STEP 1 is free.
REM
REM  ---------------------------------------------------------------------
REM  WHY A SEPARATE .BAT
REM  ---------------------------------------------------------------------
REM  run-aihub300-eval.bat writes to  .tmp\photo_test_results_aihub300.json
REM  with NO tag.  That file is the session-49 measurement and it is the
REM  entire evidence base for IP/178 (the "137/300 = 45.7%%" number, the
REM  143-photo tautology finding, the 29 discarded photos).
REM
REM  Re-running the old .bat would OVERWRITE it.  The archive logic would
REM  keep the bytes, but "aihub300 = this file" as an identity would be
REM  gone - the exact accident IP/177 section 3-3 created --tag to prevent.
REM
REM  So this one adds  --tag widened  ->
REM      .tmp\photo_test_results_aihub300_widened.json
REM  Both files survive.  Claude compares them directly.
REM
REM  ---------------------------------------------------------------------
REM  WHAT IS BEING TESTED
REM  ---------------------------------------------------------------------
REM  apply_food30_override now accepts a wider set of GPT names as
REM  replacement candidates (suffix tang / guk / jjigae / jeongol),
REM  guarded so that a dakbokkeumtang detection never overwrites a stew.
REM
REM  Re-scoring the session-49 file predicted:  EXACT 137 -> 161 (53.7%%).
REM  That prediction HOLDS THE ENGINE DETECTIONS FIXED.  This run does not.
REM  It also recomputes calories through match_with_db under the new names,
REM  which the re-scoring could not do.
REM
REM  ---------------------------------------------------------------------
REM  WHAT TO LOOK AT
REM  ---------------------------------------------------------------------
REM  1. EXACT count.  Expected around 161/300.  If it lands near 137 the
REM     widening did not take effect - check that food_analyzer.py is the
REM     edited copy.
REM  2. In the food30 block: "name replacement" should rise by roughly 28.
REM  3. Every applied entry now carries  widened: true/false.  The ones
REM     marked true are the replacements this change created.  Score THOSE
REM     separately (rule 57) - that is the whole point of the flag.
REM
REM  ** IN-DOMAIN WARNING **  (rule 47)
REM  The model trained on AI Hub photos.  This is an UPPER BOUND, not
REM  real-world performance.  Do NOT quote it as "the app scores this much".
REM  Do NOT put it in the same table as the 59.4%% baseline32 number.
REM ======================================================================

cd /d "%~dp0backends\NutriLens"
if errorlevel 1 goto :nodir

if not exist "tools\accuracy_test.py" goto :noscript
if not exist "..\..\Images\aihub_val" goto :noset
if not exist "models\food30_detection_v4.pt" goto :nomodel
if not exist ".env" goto :noenv

REM  Guard: if the widening is not actually in the file, this run measures
REM  the OLD behaviour for $1.50 and looks like "the change did nothing".
findstr /C:"_F30_FP_PRONE_CLASSES" "tools\food_analyzer.py" >nul
if errorlevel 1 goto :nopatch

echo.
echo ######################################################################
echo #  AI Hub holdout - AFTER category widening (session 50)             #
echo ######################################################################
echo.

echo ###### STEP 0 / 2  -  local checks, cost $0 ######
python -u tests\test_food30_override.py
if errorlevel 1 goto :testfail
echo.
echo   Unit tests passed (expect 89 tests, OK).
echo.

echo ###### STEP 1 / 2  -  dry run, cost $0 ######
python -u tools\accuracy_test.py --photo --set aihub300 --tag widened --dry-run
if errorlevel 1 goto :dryfail

echo.
echo ======================================================================
echo  Check the list above.  30 classes, 10 photos each.
echo ======================================================================
echo.
echo ###### STEP 2 / 2  -  300 photos, about $1.50 ######
echo.
echo  Press Ctrl+C now if you do not want to spend $1.50.
echo.
pause

python -u tools\accuracy_test.py --photo --set aihub300 --tag widened
if errorlevel 1 goto :runfail

echo.
echo ======================================================================
echo  DONE.
echo  Saved:  backends\NutriLens\.tmp\photo_test_results_aihub300_widened.json
echo  The session-49 file photo_test_results_aihub300.json was NOT touched.
echo  The 59.4%% baseline and the production file were NOT touched.
echo.
echo  Just tell Claude it finished - Claude reads both files and diffs them.
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

:noset
echo.
echo  [STOP] Images\aihub_val not found.
goto :end

:nomodel
echo.
echo  [STOP] models\food30_detection_v4.pt not found.
echo         Without it this measures GPT-4o alone, for $1.50.
goto :end

:noenv
echo.
echo  [STOP] backends\NutriLens\.env not found (needs OPENAI_API_KEY).
goto :end

:nopatch
echo.
echo  [STOP] tools\food_analyzer.py does not contain _F30_FP_PRONE_CLASSES.
echo         The session-50 widening is NOT in this copy.  Running now would
echo         spend $1.50 measuring the old behaviour.  Nothing was spent.
goto :end

:testfail
echo.
echo  [STOP] Unit tests failed - see above.  NOTHING was spent.
echo         Fix that first; do not pay to measure a broken build.
goto :end

:dryfail
echo.
echo  [STOP] The dry run failed - see above.  NOTHING was spent.
goto :end

:runfail
echo.
echo  [STOP] The measurement failed - see above.
echo         If a result file was written, check its "usable" field
echo         before quoting any number from it.
goto :end

:end
echo.
pause
