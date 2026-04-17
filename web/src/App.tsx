import { useState, useCallback, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import type { Step, SurveyAnswers, RecommendationResult } from './types'
import { getRecommendation } from './api/client'
import { submitSurveyAnalytics } from './lib/analytics'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import InstallPrompt from './components/InstallPrompt'
import DataCollectionNotice from './components/DataCollectionNotice'
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
          <Route path="/about" element={<About />} />
          <Route path="/team" element={<Team />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/survey" element={<SurveyFlow />} />
          <Route path="/health-report" element={<HealthReport />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </main>
      <Footer />
      <InstallPrompt />
      <DataCollectionNotice />
    </BrowserRouter>
  )
}
