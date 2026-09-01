@echo off
REM ======================================================================
REM  AI Hub holdout evaluation - 30 classes x 10 photos.  (session 49)
REM
REM  100%% ASCII, CRLF.
REM
REM  COST: about $1.50  (300 photos).   STEP 1 is free.
REM
REM  ---------------------------------------------------------------------
REM  WHY THIS EXISTS
REM  ---------------------------------------------------------------------
REM  IP/174 section 4-3 asked: "in production conditions, does the engine
REM  fill in what GPT-4o misses?"
REM
REM  The 2026-08-28 run answered 0 replacements.  That was NOT the engine
REM  failing.  Of the 32 baseline photos, the engine detected something in
REM  exactly ONE (bibimbap -> dolsotbap 0.86, not replaced because GPT was
REM  already right).  The only true food30 photo in the set, 105_galbitang,
REM  produced detected:{} - GPT said "nothing recognized" and so did the
REM  engine, in BOTH raw and production.
REM
REM  So baseline32 cannot answer the question.  The engine has no work to
REM  do there.  This set gives it work: 300 photos whose ground truth is
REM  one of the 30 food30 classes.
REM
REM  ---------------------------------------------------------------------
REM  WHAT THIS SET IS - AND IS NOT
REM  ---------------------------------------------------------------------
REM  Source: Images\aihub_val\  (AI Hub Validation holdout, 1800 photos)
REM    - real phone originals, EXIF shows LG / Samsung / iPhone
REM    - verified zero overlap with the 47,832 training images
REM    - ground truth = FOLDER NAME (filenames like 04_043_04013002_...
REM      carry no readable label)
REM    - sampling = sort by filename, take first 10 per class, so the
REM      same 300 photos every run
REM
REM  ** IN-DOMAIN WARNING **
REM  The model trained on AI Hub photos.  This is the same shooting
REM  condition.  The number you get is an UPPER BOUND on real-world
REM  performance, not real-world performance (rule 47).
REM  Do NOT quote it as "the app scores this much".
REM
REM  ---------------------------------------------------------------------
REM  WHAT TO LOOK AT
REM  ---------------------------------------------------------------------
REM  Not EXACT%% alone.  In the food30 engine block:
REM    - "name replacement" (changed)   how often the engine overrode GPT
REM    - disagreement                   engine saw something, did not act
REM  And then the hard part: of the replacements, how many turned a
REM  correct GPT answer into a wrong one.  That is the cost side of
REM  IP/176, and it has never been measured.
REM
REM  Results go to .tmp\photo_test_results_aihub300.json - a separate
REM  file.  Neither the 59.4%% baseline nor the production file is touched.
REM ======================================================================

cd /d "%~dp0backends\NutriLens"
if errorlevel 1 goto :nodir

if not exist "tools\accuracy_test.py" goto :noscript
if not exist "..\..\Images\aihub_val" goto :noset

REM  The whole point of this set is measuring the ENGINE.  If the model file
REM  is missing the run still costs $1.50 and returns changed:0 - which reads
REM  as "the engine changes nothing".  Opposite conclusion.  Check up front.
if not exist "models\food30_detection_v4.pt" goto :nomodel
if not exist ".env" goto :noenv

echo.
echo ######################################################################
echo #  AI Hub holdout evaluation                                         #
echo ######################################################################
echo.

echo ###### STEP 1 / 2  -  dry run, cost $0 ######
echo Shows exactly which photos and which ground-truth labels will be used.
echo Nothing is sent anywhere in this step.
echo.
python -u tools\accuracy_test.py --photo --set aihub300 --dry-run
if errorlevel 1 goto :dryfail

echo.
echo ======================================================================
echo  Check the list above.  It should be 30 classes, 10 photos each.
echo  The dry run already STOPS if the class count or per-class count is
echo  off, so reaching this line means the set is the expected shape.
echo  Still worth a look: do the folder names match the actual food?
echo ======================================================================
echo.
echo ###### STEP 2 / 2  -  300 photos, about $1.50 ######
echo.
echo  Press Ctrl+C now if you do not want to spend $1.50.
echo.
pause

python -u tools\accuracy_test.py --photo --set aihub300
if errorlevel 1 goto :runfail

echo.
echo ======================================================================
echo  DONE.
echo  Saved: backends\NutriLens\.tmp\photo_test_results_aihub300.json
echo  The 59.4%% baseline and the production file were NOT touched.
echo.
echo  Just tell Claude it finished - Claude reads the file directly.
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
echo         Run run-aihub-val-evalset.bat first to extract the holdout.
goto :end

:nomodel
echo.
echo  [STOP] models\food30_detection_v4.pt not found.
echo         Without it the engine cannot run and this measurement is
echo         pointless - it would only measure GPT-4o alone, for $1.50.
goto :end

:noenv
echo.
echo  [STOP] backends\NutriLens\.env not found (needs OPENAI_API_KEY).
goto :end

:dryfail
echo.
echo  [STOP] The dry run failed - see the message above.
echo         NOTHING was spent.  Fix that first; the paid run would stop
echo         at the same place.
goto :end

:runfail
echo.
echo  [STOP] The measurement failed - see the message above.
echo         If a result file was written, check its "usable" field
echo         before quoting any number from it.
goto :end

:end
echo.
pause
