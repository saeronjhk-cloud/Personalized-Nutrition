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
import Meal from './pages/Meal'
import WeeklyReport from './pages/WeeklyReport'
import LoginEmail from "./components/auth/LoginEmail";
import AuthCallback from "./pages/AuthCallback";
import Account from "./pages/Account";

const INITIAL_ANSWERS: SurveyAnswers = {
  성별: 'male',
  나이: 30,
  신장: 170,
  체중: 65,
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
    // 만 14세 미만 아동 이용 제한(처리방침 §9 · 백스톱). 제출 차단.
    if ((answers.나이 ?? 0) < 14) {
      setError('본 서비스는 만 14세 미만은 이용할 수 없습니다. 나이를 확인해 주세요.')
      setStep('results')
      return
    }
    setStep('loading')
    setError(null)
    try {
      const data = await getRecommendation(answers)
      setResult(data)
      setStep('results')
      // 익명 분석 수집 (fire-and-forget, 실패해도 UI 영향 없음)
      submitSurveyAnalytics(answers, data)
    } catch (e: any) {
      setError(e.message || '추천 결과를 가져오는 데 실패했습니다.')
      setStep('results')
    }
  }, [answers])

  const restart = useCallback(() => {
    setAnswers({ ...INITIAL_ANSWERS })
    setResult(null)
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
  if (step === 'results') return <Results result={result} answers={answers} error={error} onRestart={restart} />

  return (
    <Questions
      step={step}
      answers={answers}
      onUpdate={updateAnswers}
      onNext={(nextStep) => setStep(nextStep)}
      onBack={(prevStep) => setStep(prevStep)}
      onSubmit={submitSurvey}
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
            <Route path="/scan" element={<Scan />} />
          )}
          {MEAL_ENABLED && (
            <Route path="/meal" element={<Meal />} />
          )}
          {MEAL_ENABLED && (
            <Route path="/weekly-report" element={<WeeklyReport />} />
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
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <InstallPrompt />
    </BrowserRouter>
  )
}
