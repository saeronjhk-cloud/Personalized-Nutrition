@echo off
REM ======================================================================
REM  Build a TRUE holdout eval set from the AI Hub Validation split.
REM  (session 48, 2026-08-26)
REM
REM  100%% ASCII, CRLF.
REM
REM  COST: $0.  No OpenAI call.  No torch.  Reads the external drive only.
REM
REM  ---------------------------------------------------------------------
REM  WHY
REM  ---------------------------------------------------------------------
REM  All 348 evaluation photos we have are stock/blog shots (IP/175 3-4).
REM  Training is phone snapshots, real use is phone photos, and only the
REM  evaluation set is studio work. We have been measuring in the wrong place.
REM
REM  And the AI Hub TRAINING split has nothing left to hold out: of 47,834
REM  labels across the 30 classes, 47,832 went into v4.
REM
REM  The Validation split on the external drive is the answer. Same shooting
REM  conditions as training - so close to real use - but the model has never
REM  seen a single one of them. 6,132 photos across the 30 classes.
REM
REM  ---------------------------------------------------------------------
REM  WHAT THIS DOES
REM  ---------------------------------------------------------------------
REM  Reads only TWO of the seven source zips - 01 (rice) and 04 (soup).
REM  The other five are 121GB of food groups food30 does not cover.
REM  It never unpacks them; it reads the zip index and pulls single files.
REM
REM  Then it CHECKS FOR LEAKAGE: every Validation filename is compared
REM  against the 47,832 filenames that went into training. One overlap and
REM  it stops. Validation should never overlap - but assuming that instead
REM  of checking it is how a silently inflated score gets published.
REM
REM  Output: Images\aihub_val\<food name>\*.jpg
REM  That is the same folder shape as Images\tang_2cha, so
REM  run-attractor-diagnose.bat picks it up with no code change.
REM
REM  ---------------------------------------------------------------------
REM  READ THIS BEFORE QUOTING ANY NUMBER FROM IT
REM  ---------------------------------------------------------------------
REM  This is an IN-DOMAIN measurement. Same photographic conditions as
REM  training. It is an UPPER BOUND on real-world accuracy, not real-world
REM  accuracy. The domain gap to actual user photos is still unmeasured.
REM  (IP/175 3-5, rule 47)
REM
REM  STEP 1 is a dry run - it prints what it would take and writes nothing.
REM  STEP 2 asks before extracting.
REM ======================================================================

cd /d "%~dp0backends\NutriLens"
if errorlevel 1 goto :nodir

set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

if not exist "tools\build_aihub_val_evalset.py" goto :noscript

echo.
echo ###### STEP 1 / 2  -  dry run, writes nothing ######
echo.
python -u tools\build_aihub_val_evalset.py --dry-run
if errorlevel 1 goto :failed

echo.
echo ======================================================================
echo  Check the per-class counts above.
echo  If they look right, press a key to extract 60 photos per class
echo  (about 1,800 photos at original resolution).
echo  To stop here instead, close this window.
echo ======================================================================
pause

echo.
echo ###### STEP 2 / 2  -  extracting ######
echo.
python -u tools\build_aihub_val_evalset.py --per-class 60
if errorlevel 1 goto :failed

echo.
echo ======================================================================
echo  DONE.  Photos are in  Images\aihub_val\
echo  Next: run-attractor-diagnose.bat  picks them up automatically.
echo  Just tell Claude it finished.
echo ======================================================================
goto :end

:noscript
echo.
echo [ERROR] tools\build_aihub_val_evalset.py not found.
goto :end

:nodir
echo.
echo [ERROR] Could not enter: %~dp0backends\NutriLens
goto :end

:failed
echo.
echo ======================================================================
echo  Stopped.  Send the whole output to Claude.
echo  Nothing was changed on the external drive - this script only reads it.
echo ======================================================================

:end
echo.
pause
