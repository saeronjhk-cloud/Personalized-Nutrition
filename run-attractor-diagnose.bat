@echo off
REM ======================================================================
REM  food30 attractor / image-quality / tau diagnosis.  (session 48)
REM
REM  100%% ASCII, CRLF.
REM
REM  COST: $0.  No OpenAI call.  Pure local inference.
REM  SAFE: does NOT change tau.  Does NOT touch git.  Writes only to
REM        backends\NutriLens\.tmp\diagnose\   (rule 26).
REM  Runtime: 8-15 minutes on CPU (about 1,180 inferences).
REM           Use --skip-quality for a 3-5 minute run (350 inferences).
REM
REM  ---------------------------------------------------------------------
REM  WHAT SESSION 48 FOUND BEFORE WRITING THIS
REM  ---------------------------------------------------------------------
REM  IP/174 listed the evaluation photos as:
REM        "soup 2nd batch  26"   at  Images\tang_2cha\
REM
REM  26 was the number of SUBFOLDERS, not photos.
REM  That folder holds 185 photos: 125 positive in 24 class folders,
REM  plus 60 negatives in 6 confusion folders.
REM  And tools\check_eval_photos.py --merge was never run, so none of
REM  those 185 have ever been measured.
REM
REM  Counting everything: 198 positive + 150 negative = 348 photos,
REM  and EVERY ONE of the 30 food30 classes has 5-11 ground-truth photos.
REM
REM  This matters because IP/174 froze tau partly on "n=3, too small to
REM  decide" (rule 3).  Brown rice actually has 8 photos.  Black rice 8.
REM  Every soup class has 5 or more.  The sample was never the limit.
REM
REM  ---------------------------------------------------------------------
REM  WHAT THIS RUN DECIDES
REM  ---------------------------------------------------------------------
REM  [0] Inventory first.  Prints what it counted BEFORE counting anything
REM      else, so you can see the sample matches the question (rule 38).
REM
REM  [1] Attractor diagnosis.  IP/174 proved "gitajapgokbap" swallows brown
REM      and black rice, and left soups as "not investigated".
REM      The metric is SELF-CHECKED first: it must reproduce the known rice
REM      answer before its soup numbers mean anything.
REM
REM  [2] Image-quality collapse curve.  IP/174 section 1-5 saw white-rice-3
REM      drop 0.93 -> 0.17 from JPEG q80 re-encoding alone, but n=2 so it
REM      stayed unconfirmed.  This runs the full rice set over a
REM      quality x size grid.
REM
REM  [3] Tau ladder with BOTH failure directions in one table:
REM      false positives that appear AND correct answers that get eaten
REM      by the attractor (rule 40).
REM
REM  Nothing here changes tau, the model, or any production file.
REM ======================================================================

cd /d "%~dp0backends\NutriLens"
if errorlevel 1 goto :nodir

set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

if not exist "models\food30_detection_v4.pt" goto :nomodel
if not exist "tools\food30_diagnose_attractor.py" goto :noscript

echo.
echo ###### food30 attractor + tau diagnosis (session49) - cost $0 ######
echo ###### --skip-quality: rice positives 52 to 532, grid would be 2h+ ######
echo.
echo This takes 20-40 minutes (2,148 photos). Let it finish.
echo.
python -u tools\food30_diagnose_attractor.py --skip-quality
if errorlevel 1 goto :failed

echo.
echo ======================================================================
echo  DONE.  A JSON file was saved under .tmp\diagnose\.
echo  Just tell Claude it finished - Claude can read the file directly.
echo.
echo  If you only want a quick look next time:
echo    python tools\food30_diagnose_attractor.py --inventory-only
echo    python tools\food30_diagnose_attractor.py --skip-quality
echo ======================================================================
goto :end

:noscript
echo.
echo [ERROR] tools\food30_diagnose_attractor.py not found.
goto :end

:nomodel
echo.
echo [ERROR] models\food30_detection_v4.pt not found.
goto :end

:nodir
echo.
echo [ERROR] Could not enter: %~dp0backends\NutriLens
goto :end

:failed
echo.
echo ======================================================================
echo  Diagnosis could not complete.  Send the whole output to Claude.
echo  Nothing was changed - this script only reads.
echo ======================================================================

:end
echo.
pause
