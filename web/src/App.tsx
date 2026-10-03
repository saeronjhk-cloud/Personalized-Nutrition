import { useState, useCallback, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import type { Step, SurveyAnswers, RecommendationResult } from './types'
import { getRecommendation } from './api/client'
import { submitSurveyAnalytics, hasConsentedCollection, markConsentAcknowledged } from './lib/analytics'
import { CHECKUP_ENABLED, INSIGHTS_ENABLED, MEOKSEON_ENABLED, MEAL_ENABLED } from './lib/flags'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import InstallPrompt from './components/InstallPrompt'
import ConsentGate from './components/ConsentGate'
import RecommendSources from './components/RecommendSources'
import { supabase } from './lib/supabase'
import { loadUnifiedInputs } from './lib/loadUnifiedInputs'
import { composeUnifiedInput } from './domain/unified/compose'
import { runUnifiedRecommendation, type UnifiedResult } from './domain/unified/recommend'
import { shouldSkipGoalStep, withGoals } from './domain/goals/goals'
import Home from './pages/Home'
import About from './pages/About'
import Team from './pages/Team'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Resources from './pages/Resources'
import Questions from './pages/Questions'
import Results from './pages/Results'
import Loading from './pages/Loading'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import HealthReport from './pages/HealthReport'
import Checkup from './pages/Checkup'
import CheckupManage from './pages/CheckupManage'
import EditCheckup from './components/checkup/EditCheckup'
import ViewCheckup from './components/checkup/ViewCheckup'
import SurveyManage from './pages/SurveyManage'
import SurveyResultView from './components/survey/SurveyResultView'
import Dashboard from './pages/Dashboard'
import Recommend from './pages/Recommend'
import Insights from './pages/Insights'
import Scan from './pages/Scan'
import Admin from './pages/Admin'   // 세션72d — 메뉴에 없음 · 서버가 ADMIN_EMAILS 로 판정
import MyReports from './pages/MyReports'
import Meal from './pages/Meal'
import WeeklyReport from './pages/WeeklyReport'
import BetaLanding from './pages/BetaLanding'
import LoginEmail from "./components/auth/LoginEmail";
import AuthCallback from "./pages/AuthCallback";
import Account from "./pages/Account";
import { EMPTY_BODY, bodyIssueText, bodyStepIssues } from './domain/survey/body_input'

// 신체 정보는 빈칸 시작 — 초기값 그대로 제출 방지 (IP/integration/survey_initial_values_eval_v1.md)
const INITIAL_ANSWERS: SurveyAnswers = {
  ...EMPTY_BODY,
  체중변화: '변화없음',
  증상: [],
  목표: [],
  현재복용영양제: [],
  기저질환: [],
  가족력: [],
}

function SurveyFlow() {
  const [step, setStep] = useState<Step>('body')
  const [answers, setAnswers] = useState<SurveyAnswers>({ ...INITIAL_ANSWERS })
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const isPopState = useRef(false)
  const [consented, setConsented] = useState(hasConsentedCollection())
  // Phase G — 로그인 여부(null=확인 중). 로그인 + 식사 기록 ON 이면 목표 단계를 건너뛴다(D2).
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [unified, setUnified] = useState<UnifiedResult | null>(null)
  const [goals, setGoals] = useState<string[] | null>(null)
  const [savedAnswers, setSavedAnswers] = useState<SurveyAnswers | null>(null)
  const skipGoals = shouldSkipGoalStep({ loggedIn: loggedIn === true, mealEnabled: MEAL_ENABLED })

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => { if (alive) setLoggedIn(!!data.session) })
    return () => { alive = false }
  }, [])

  // 브라우저 뒤로가기/앞으로가기 처리
  useEffect(() => {
    const handlePopState = () => {
      const stateData = window.history.state?.usr
      if (stateData?.step) {
        isPopState.current = true
        setStep(stateData.step)
        if (stateData.step !== 'results' && stateData.step !== 'loading') {
          // 결과/로딩이 아닌 설문 단계로 돌아갈 때
        }
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // 단계가 바뀔 때 브라우저 히스토리에 기록 (popstate로 인한 변경 제외)
  useEffect(() => {
    if (isPopState.current) {
      isPopState.current = false
      return
    }
    // 로딩 단계는 히스토리에 안 남김
    if (step !== 'loading') {
      window.history.pushState({ usr: { step } }, '', '/survey')
    }
  }, [step])

  const updateAnswers = useCallback((patch: Partial<SurveyAnswers>) => {
    setAnswers(prev => ({ ...prev, ...patch }))
  }, [])

  const submitSurvey = useCallback(async () => {
    // 신체 정보 미입력 백스톱(앞으로가기 등으로 1단계를 건너뛴 경우) — survey_initial_values_eval_v1
    const bodyIssues = bodyStepIssues(answers)
    if (bodyIssues.length > 0) {
      setError(`기본 신체 정보가 비어 있어요. 처음 단계에서 ${bodyIssueText(bodyIssues)}.`)
      setStep('results')
      return
    }
    // 만 14세 미만 아동 이용 제한(처리방침 §9 · 백스톱). 제출 차단.
    if ((answers.나이 ?? 0) < 14) {
      setError('본 서비스는 만 14세 미만은 이용할 수 없습니다. 나이를 확인해 주세요.')
      setStep('results')
      return
    }
    setStep('loading')
    setError(null)
    try {
      // Phase G — 로그인: 방금 답한 설문 + 저장된 검진·식이 7일·목표를 통합 엔진으로 (= /recommend 와 같은 엔진)
      //           비로그인: 현행 설문 단독 엔진 그대로 (G08 회귀 0)
      const loaded = loggedIn ? await loadUnifiedInputs({ skipLatestSurvey: true }) : { isLoggedIn: false as const }
      if (loaded.isLoggedIn) {
        const res = runUnifiedRecommendation(composeUnifiedInput({ freshSurvey: answers, loaded: loaded.inputs }))
        // 저장 스냅샷: 이 추천에 실제로 쓰인 목표를 설문 행에 남긴다(과거 결과 재현·집계 호환).
        const effective = loaded.inputs.goals !== null ? withGoals(answers, loaded.inputs.goals) : answers
        setUnified(res)
        setGoals(loaded.inputs.goals)
        setSavedAnswers(effective)
        setResult(res)
        setStep('results')
        submitSurveyAnalytics(effective, res)
      } else {
        const data = await getRecommendation(answers)
        setUnified(null)
        setGoals(null)
        setSavedAnswers(answers)
        setResult(data)
        setStep('results')
        // 익명 분석 수집 (fire-and-forget, 실패해도 UI 영향 없음)
        submitSurveyAnalytics(answers, data)
      }
    } catch (e: any) {
      setError(e.message || '추천 결과를 가져오는 데 실패했습니다.')
      setStep('results')
    }
  }, [answers, loggedIn])

  const restart = useCallback(() => {
    setAnswers({ ...INITIAL_ANSWERS })
    setResult(null)
    setUnified(null)
    setGoals(null)
    setSavedAnswers(null)
    setError(null)
    setStep('body')
  }, [])

  if (!consented) {
    return (
      <ConsentGate
        onAccept={() => { markConsentAcknowledged(); setConsented(true) }}
        onDecline={() => navigate('/')}
      />
    )
  }

  if (step === 'loading') return <Loading />
  if (step === 'results') {
    return (
      <>
        {unified && !error && (
          <div className="survey-container" style={{ paddingBottom: 0 }}>
            <RecommendSources result={unified} goals={goals} />
          </div>
        )}
        <Results result={result} answers={savedAnswers ?? answers} error={error} onRestart={restart} />
      </>
    )
  }
  // 로그인 여부 확인 전엔 단계 목록이 흔들리지 않도록 잠깐 비운다(수 ms).
  if (loggedIn === null) return <div className="survey-container fade-in" />

  return (
    <Questions
      step={step}
      answers={answers}
      onUpdate={updateAnswers}
      onNext={(nextStep) => setStep(nextStep)}
      onBack={(prevStep) => setStep(prevStep)}
      onSubmit={submitSurvey}
      skipGoals={skipGoals}
    />
  )
}

/** 안드로이드 하드웨어 뒤로가기 버튼 처리 */
function BackButtonHandler() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = CapApp.addListener('backButton', ({ canGoBack }) => {
      // 홈 화면이면 앱 종료
      if (location.pathname === '/' && !canGoBack) {
        CapApp.exitApp()
      } else if (canGoBack) {
        window.history.back()
      } else {
        navigate('/')
      }
    })

    return () => { handler.then(h => h.remove()) }
  }, [location.pathname, navigate])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <BackButtonHandler />
      <Navbar />
      <main className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/recommend" element={<Recommend />} />
          {INSIGHTS_ENABLED && (
            <Route path="/insights" element={<Insights />} />
          )}
          {MEOKSEON_ENABLED && (
            <>
              <Route path="/scan" element={<Scan />} />
              {/* 「내가 보낸 제보」 — 기존 관례(`/checkup/manage`·`/survey/manage`)를 따라
                  기능 아래에 둔다. ⚠ 경로는 `pages/Scan.tsx` 의 MY_REPORTS_PATH 와 같아야 한다. */}
              <Route path="/scan/reports" element={<MyReports />} />
            </>
          )}
          {MEAL_ENABLED && (
            <Route path="/meal" element={<Meal />} />
          )}
          {MEAL_ENABLED && (
            <Route path="/weekly-report" element={<WeeklyReport />} />
          )}
          {MEAL_ENABLED && (
            /* 사진 수집 베타 패널 입구 (세션54). 식사 기능이 꺼져 있으면 의미가 없으므로 같이 묶는다. */
            <Route path="/beta" element={<BetaLanding />} />
          )}
          <Route path="/about" element={<About />} />
          <Route path="/team" element={<Team />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/survey" element={<SurveyFlow />} />
          <Route path="/survey/manage" element={<SurveyManage />} />
          <Route path="/survey/view/:responseId" element={<SurveyResultView />} />
          {/* checkup routes gated by compliance flag (flags.ts / VITE_CHECKUP_ENABLED) */}
          {CHECKUP_ENABLED && (
            <>
              <Route path="/checkup" element={<Checkup />} />
              <Route path="/checkup/manage" element={<CheckupManage />} />
              <Route path="/checkup/edit/:recordId" element={<EditCheckup />} />
              <Route path="/checkup/view/:recordId" element={<ViewCheckup />} />
            </>
          )}
          <Route path="/health-report" element={<HealthReport />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/login" element={<LoginEmail />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <InstallPrompt />
    </BrowserRouter>
  )
}
