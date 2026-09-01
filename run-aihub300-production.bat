@echo off
REM ======================================================================
REM  AI Hub holdout x PRODUCTION preprocessing  (session 51)
REM  30 classes x 10 photos = 300.   100%% ASCII, CRLF.
REM
REM  COST: about $1.50.  STEPS 0 and 1 are free.
REM
REM  ---------------------------------------------------------------------
REM  WHAT THIS ANSWERS
REM  ---------------------------------------------------------------------
REM  Session 50 measured the category widening under RAW conditions only:
REM      raw        137 -> 159 EXACT   (engine contribution +24, harm 0)
REM  Production sends a DIFFERENT image to GPT-4o (minimized / re-encoded).
REM  Nobody has measured whether the engine's contribution grows or shrinks
REM  there.  That is the whole question this run exists to answer.
REM
REM  It matters because production is what users actually get.  A +24 that
REM  only exists under raw is a number about a lab, not about the app.
REM
REM  ---------------------------------------------------------------------
REM  WHY THIS IS NOT OBVIOUS
REM  ---------------------------------------------------------------------
REM  IP/177 section 14-3: preprocessing is NOT a one-way handicap.
REM  Two photos in baseline32 reacted in OPPOSITE directions and cancelled:
REM      jogi-gui        raw NONE  3/3 | production EXACT 2/2
REM      jjukkumi-bokkeum raw EXACT 3/3 | production NONE  2/2
REM  So "production is worse" is an assumption, not a measurement.
REM  Cause still uninvestigated.
REM
REM  ---------------------------------------------------------------------
REM  FILE SAFETY
REM  ---------------------------------------------------------------------
REM  Saves to  .tmp\photo_test_results_aihub300_production.json
REM  Distinct from both existing files - neither is touched:
REM      photo_test_results_aihub300.json          (session 49, raw, pre-widening)
REM      photo_test_results_aihub300_widened.json  (session 50, raw, post-widening)
REM  No --tag is used: "production" is a RESERVED tag name (it would collide
REM  with the preprocess suffix).  The preprocess mode already splits the name.
REM
REM  ---------------------------------------------------------------------
REM  WHAT TO LOOK AT
REM  ---------------------------------------------------------------------
REM  1. EXACT count vs 159 (the raw+widened number).  Either direction is a
REM     real finding - do NOT assume it should be lower.
REM  2. "name replacement" count vs 96, and how many carry widened:true.
REM     If the engine fires LESS under production, that is a separate problem
REM     from GPT accuracy and needs its own fix.
REM  3. The engine input is the ORIGINAL image in both modes.  So any change
REM     in engine detections is noise, not preprocessing - worth checking.
REM
REM  ** IN-DOMAIN WARNING **  (rule 47)
REM  Upper bound, not real-world performance.  Do NOT compare to the 59.4%
REM  baseline32 number - different set, different domain.
REM ======================================================================

cd /d "%~dp0backends\NutriLens"
if errorlevel 1 goto :nodir

if not exist "tools\accuracy_test.py" goto :noscript
if not exist "..\..\Images\aihub_val" goto :noset
if not exist "models\food30_detection_v4.pt" goto :nomodel
if not exist ".env" goto :noenv

REM  Guard: the session-50 widening must be present, otherwise this $1.50
REM  measures the OLD engine under production and the comparison is void.
findstr /C:"_F30_FP_PRONE_CLASSES" "tools\food_analyzer.py" >nul
if errorlevel 1 goto :nopatch

echo.
echo ######################################################################
echo #  AI Hub holdout x PRODUCTION preprocessing (session 51)            #
echo ######################################################################
echo.

echo ###### STEP 0 / 2  -  local checks, cost $0 ######
python -u tests\test_food30_override.py
if errorlevel 1 goto :testfail
echo.
echo   Unit tests passed (expect 89 tests, OK).
echo.

echo ###### STEP 1 / 2  -  dry run, cost $0 ######
python -u tools\accuracy_test.py --photo --set aihub300 --preprocess production --dry-run
if errorlevel 1 goto :dryfail

echo.
echo ======================================================================
echo  Check the list above.  30 classes, 10 photos each.
echo  Confirm the header says  preprocess: production.
echo ======================================================================
echo.
echo ###### STEP 2 / 2  -  300 photos, about $1.50 ######
echo.
echo  Press Ctrl+C now if you do not want to spend $1.50.
echo.
pause

python -u tools\accuracy_test.py --photo --set aihub300 --preprocess production
if errorlevel 1 goto :runfail

echo.
echo ======================================================================
echo  DONE.
echo  Saved:  backends\NutriLens\.tmp\photo_test_results_aihub300_production.json
echo  Neither session-49 nor session-50 result file was touched.
echo.
echo  Just tell Claude it finished - Claude diffs all three runs.
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
echo         The session-50 widening is NOT in this copy, so this run could
echo         not be compared with the session-50 result.  Nothing was spent.
goto :end

:testfail
echo.
echo  [STOP] Unit tests failed - see above.  NOTHING was spent.
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
