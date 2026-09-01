@echo off
REM ======================================================================
REM  Production-condition re-measurement.   (session 48, 2026-08-24)
REM
REM  100%% ASCII, CRLF.
REM
REM  COST: about $0.16  (32 photos, one OpenAI call each).
REM  Runtime: FASTER than the normal G4 run - the upload is ~2x smaller.
REM
REM  ---------------------------------------------------------------------
REM  WHY THIS EXISTS   (IP/174 section 4)
REM  ---------------------------------------------------------------------
REM  Session 47 read the code and found an asymmetry:
REM
REM                     engine (food30)      GPT-4o
REM    production       original bytes       768px, detail:low, center-crop
REM    evaluation       original bytes       original, detail:high, NO crop
REM
REM  The engine gets the exact same input in both paths.  Only GPT-4o is
REM  fed better in evaluation than in production.  So every engine
REM  contribution number measured so far is a LOWER BOUND.
REM
REM  This run removes that handicap: GPT-4o now gets the same minimized
REM  image production sends it.  Same function, not a copy -
REM  image_minimize.minimize_to_data_url, the one test_server calls.
REM
REM  ---------------------------------------------------------------------
REM  WHAT MUST NOT HAPPEN
REM  ---------------------------------------------------------------------
REM  1. Do NOT change production to match evaluation.  image_minimize is a
REM     LEGAL control, not an optimization - the original frame must never
REM     leave for OpenAI (IP/128, IP/141, lawyer review IP/117-125).
REM     We change the evaluation, never the other direction.
REM
REM  2. Do NOT compare this number to 59.4%%.  Different preprocessing =
REM     different baseline (rule 34).  The script refuses to print a G4
REM     verdict for this run and says so on screen.
REM     Results go to a SEPARATE file:
REM       .tmp\photo_test_results_production.json
REM     The 59.4%% file (photo_test_results.json) is not touched.
REM
REM  ---------------------------------------------------------------------
REM  WHAT TO LOOK AT
REM  ---------------------------------------------------------------------
REM  Not EXACT%%.  Look at the food30 engine block:
REM    - "name replacement" count  (changed)
REM    - photos_with_engine_field
REM  The question is whether the engine fills in what GPT-4o starts
REM  missing once it is handicapped the way production handicaps it.
REM
REM  Compare against the raw run in .tmp\photo_test_results.json.
REM ======================================================================

cd /d "%~dp0backends\NutriLens"
if errorlevel 1 goto :nodir

set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

if not exist ".env" goto :noenv
if not exist "tools\accuracy_test.py" goto :noscript
if not exist "tools\image_minimize.py" goto :nomin
if not exist "models\food30_detection_v4.pt" goto :nomodel

echo.
echo ###### STEP 1 / 2  -  minimization self-check, cost $0 ######
echo.
echo Proves the images really are minimized before any money is spent.
echo Axis A: original_frame_sent must be False, crop area ratio under 0.90.
echo.
python -u tools\verify_preprocess_production.py
if errorlevel 1 goto :minfail

echo.
echo ###### STEP 2 / 2  -  32 baseline photos, production preprocessing ######
echo.
echo Cost: about $0.16.  This does NOT overwrite the 59.4%% baseline file.
echo.
pause
python -u tools\accuracy_test.py --photo --set baseline32 --preprocess production
if errorlevel 1 goto :runfail

echo.
echo ======================================================================
echo  DONE.
echo  Saved: backends\NutriLens\.tmp\photo_test_results_production.json
echo  The raw baseline file photo_test_results.json was NOT touched.
echo  Just tell Claude it finished - Claude can read both files.
echo ======================================================================
goto :end

:noenv
echo.
echo [ERROR] backends\NutriLens\.env not found - OPENAI_API_KEY cannot load.
goto :end

:noscript
echo.
echo [ERROR] tools\accuracy_test.py not found.
goto :end

:nomin
echo.
echo [ERROR] tools\image_minimize.py not found.
goto :end

:nomodel
echo.
echo [ERROR] models\food30_detection_v4.pt not found.
echo         Without it the engine is silent and this run measures nothing.
goto :end

:minfail
echo.
echo ======================================================================
echo  Minimization self-check FAILED.  No API call was made, no money spent.
echo  Send the whole output to Claude.  Do not run step 2 by hand.
echo ======================================================================
goto :end

:runfail
echo.
echo ======================================================================
echo  The measurement stopped early.  Send the whole output to Claude.
echo  Partial results may still be in .tmp - do not delete anything.
echo ======================================================================

:nodir
echo.
echo  [STOP] Could not enter backends\NutriLens - is this .bat in the project root?
goto :end

:end
echo.
pause
