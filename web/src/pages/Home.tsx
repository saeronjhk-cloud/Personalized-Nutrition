/**
 * 홈 — 개편 v1 P0 (2026-10-04). 방문자 = 대표 CTA 1개 + 하나의 흐름 · 재방문(로그인+기록) = 오늘 기록·오늘의 한 가지
 * 설계·평가: IP/integration/home_redesign_v1_design.md (외부 자문 ChatGPT·Gemini 판정표 §1, H01~H16)
 * ⚠ 서박사 성함·이력·마케팅 문구는 현행 표기만(C6 서면 동의 전) · 칼로리·점수·감량 표현 금지(H11·H12)
 */
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import PageMeta from '../components/PageMeta'
import NewBlogPopup from '../components/NewBlogPopup'
import StartChooser from '../components/home/StartChooser'
import ReturningHome from '../components/home/ReturningHome'
import MealAfterScene, { MEDICAL_NOTICE } from '../components/home/MealAfterScene'
import HeroScene, { HERO_MEAL_SNAP_IMG } from '../components/home/HeroScene'
import { useSurveyHistory } from '../lib/surveyHistoryRemote'
import { useHomeData, hasStoredSession, HOME_PENDING_TIMEOUT_MS } from '../lib/homeData'
import { track } from '../lib/events'
import { resurveyState } from '../domain/survey/history'
import { decideHomeView, type HomeMode } from '../domain/home/home_mode'
import { MEOKSEON_ENABLED, MEAL_ENABLED, CHECKUP_ENABLED } from '../lib/flags'

/* ── 스크롤 시 .visible 추가 훅 (개별 요소용) ── */
function useScrollReveal(dep: unknown) {
  useEffect(() => {
    const els = document.querySelectorAll('.section-animate, .reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.01, rootMargin: '0px 0px -20px 0px' }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [dep])
}

/* ── 하나의 흐름: 먹는다 → 기록한다 → 이해한다 → 관리한다 (꺼진 기능 칸은 숨김) ── */
function Journey() {
  const steps = [
    ...(MEOKSEON_ENABLED ? [{ k: '먹는다', t: '가공식품 성분을 쉬운 말로', d: '바코드나 제품명으로 첨가물·영양성분을 10초 만에 확인해요.', to: '/scan' }] : []),
    ...(MEAL_ENABLED ? [{ k: '기록한다', t: '사진 한 장으로 식사 기록', d: '밥·국·반찬을 읽어 끼니마다 무엇이 있고 무엇이 빠졌는지 보여 드려요.', to: '/meal' }] : []),
    { k: '이해한다', t: CHECKUP_ENABLED ? '건강검진과 설문을 한곳에' : '3분 설문으로 내 상태 확인', d: CHECKUP_ENABLED ? '검진 수치와 증상·생활 습관을 모아 변화까지 비교해요.' : '증상·생활 습관·복용약을 함께 확인해요.', to: CHECKUP_ENABLED ? '/dashboard' : '/survey' },
    { k: '관리한다', t: '식단 코칭과 맞춤 영양제', d: '하루 한 가지 실천할 식사 조언과 나에게 맞는 건강기능식품을 알려 드려요.', to: '/recommend?entry=home' },
  ]
  return (
    <section className="hv-flow">
      <div className="hv-flow__inner">
        <h2 className="hv-flow__title">먹고, 기록하고, 이해하고, 관리합니다</h2>
        <ol className="hv-timeline">
          {steps.map((s, i) => (
            <li key={s.k} className="hv-timeline__item">
              <span className="hv-timeline__num" aria-hidden="true">{i + 1}</span>
              <Link to={s.to} className="hv-timeline__body">
                <span className="hv-timeline__k">{s.k}</span>
                <span className="hv-timeline__t">{s.t}</span>
                <span className="hv-timeline__d">{s.d}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ── 전문가 (현행 표기 그대로 — 숫자 카운트업은 홈에서 뺌, /team 에 상세) ── */
function Experts() {
  return (
    <section className="hv-experts">
      <h2 className="hv-experts__title">식품영양학 박사가 설계한 알고리즘</h2>
      <div className="hv-experts__lead">
        <img src="/team-kim.jpg" alt="김재환" className="hv-experts__photo" style={{ objectPosition: '65% 20%' }} />
        <div>
          <div className="hv-experts__name">김재환 <span className="hv-experts__role">대표</span></div>
          <div className="hv-experts__cred">식품영양학 박사 · 특허 14건 · 2019 대통령 표창</div>
        </div>
      </div>
      <ul className="hv-experts__list">
        <li>
          <img src="/team-seo.jpg" alt="서형주" className="hv-experts__thumb" />
          <span className="hv-experts__name">서형주 <span className="hv-experts__role">자문</span></span>
          <span className="hv-experts__cred">고려대 교수 역임 · 일본 RIKEN 연구원 · 수면과학 전문</span>
        </li>
        <li>
          <img src="/team-jang.jpg" alt="장은재" className="hv-experts__thumb" />
          <span className="hv-experts__name">장은재 <span className="hv-experts__role">자문</span></span>
          <span className="hv-experts__cred">동덕여대 교수 역임 · 비만연구센터장 · 임상영양 전문</span>
        </li>
      </ul>
      <Link to="/team" className="text-link hv-experts__more">팀 소개 자세히 보기</Link>
    </section>
  )
}

function VisitorHome({ mode }: { mode: HomeMode }) {
  return (
    <>
      {/* ━━ Hero v2 — 실제 밥상 장면 + 대표 CTA 1개 (H10 · home_redesign_v2_eval_v1 S1~S5) ━━ */}
      <section className="hero-v2">
        <div className="hero-v2__eyebrow">서박사의 영양공식</div>
        <h1 className="hero-v2__title">오늘 먹은 밥상과 영양제,<br /><span className="hero-v2__nw">겹치고 넘치는 성분을</span> <span className="hero-v2__nw">한눈에.</span></h1>
        <p className="hero-v2__sub">
          밥상 사진·3분 설문·건강검진 중 편한 것부터 시작하면,
          식사에서 놓친 점과 오늘 실천할 한 가지를 알려드려요.
        </p>
        {/* 배치 P = 제목→장면→버튼 (자문 D3, 제이 결정 10-13) */}
        <HeroScene />
        <div className="hero-v2__cta">
          <StartChooser mode={mode} cta="start" />
          <div className="hero-v2__cta-note">밥상 사진 · 3분 설문 · 건강검진 중 선택</div>
        </div>
        <div className="hero-trust-line">식품영양학 박사가 설계한 알고리즘 · 김재환 대표 · 서형주 자문 · 장은재 자문</div>
      </section>
      {MEOKSEON_ENABLED && (
        <div className="hero-v2__scan">
          <Link to="/scan" className="text-link" onClick={() => track('home_cta_click', { home_mode: mode, cta: 'scan_link' })}>
            가공식품 성분부터 보기 →
          </Link>
        </div>
      )}

      {/* ━━ «후» 장면 — 한 가지를 더하면(2단계 A1, 이모지 데모 대체 · V14) ━━ */}
      {MEAL_ENABLED && <MealAfterScene />}

      <Journey />
      <Experts />

      {/* ━━ FAQ 2 (A5 · V20) — 의학 고지는 FAQ 밖 상시(V17) ━━ */}
      <section className="hv-faq">
        <h2 className="hv-faq__title">자주 묻는 질문</h2>
        <div className="faq-list">
          <FaqItem q="정말 무료인가요?" a="네, 무료입니다. 맞춤 영양제 분석과 결과 확인, PDF 저장은 회원가입 없이도 쓸 수 있어요. 식사 기록·건강 기록처럼 이어서 보관하는 기능은 로그인 후 사용합니다. 추천된 영양제를 구매하실 때만 외부 쇼핑몰에서 직접 결제하시면 됩니다." />
          <FaqItem q="내 개인 정보가 저장되나요?" a="설문 분석은 브라우저에서 처리됩니다. 동의한 경우 설문 응답과 결과는 서비스 제공 및 기록 확인을 위해 서버에 저장됩니다. 식사 기록·내 건강 기록처럼 데이터를 이어서 보관하는 기능은 로그인한 내 계정에 저장되며, 언제든 직접 확인하고 관리할 수 있습니다." />
        </div>
      </section>

      {/* ━━ 최종 CTA (대표 CTA 와 같은 동작) ━━ */}
      <section className="hv-final">
        <img
          src={HERO_MEAL_SNAP_IMG.src}
          width={HERO_MEAL_SNAP_IMG.width}
          height={HERO_MEAL_SNAP_IMG.height}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="hv-final__img"
        />
        <div className="hv-final__body">
          <h2 className="hv-final__title">오늘 한 끼부터 시작해 보세요</h2>
          <p className="hv-final__sub">사진 한 장이든 3분 설문이든, 편한 것 하나면 충분해요.</p>
          <StartChooser mode={mode} cta="final" />
          <p className="hv-notice">{MEDICAL_NOTICE}</p>
        </div>
      </section>
    </>
  )
}

export default function Home() {
  // 로그인 사용자는 서버 설문 기록 우선(다른 기기·주소에서도 보이게) — IP/integration/survey_history_server_eval_v1.md
  const { history: surveyHistory, loading: surveyLoading } = useSurveyHistory()
  const resurvey = resurveyState(surveyHistory, new Date())
  const home = useHomeData()
  // 첫 렌더 깜빡임 제거(10-13): 세션 흔적이 있으면 판정 전까지 자리 표시 — IP/integration/home_first_render_eval_v1.md
  const [storedSession] = useState(() => hasStoredSession())
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (!storedSession) return
    const t = setTimeout(() => setTimedOut(true), HOME_PENDING_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [storedSession])
  const mode = decideHomeView({
    storedSession,
    homeLoading: home.loading,
    isLoggedIn: home.isLoggedIn,
    hasMealOrCheckup: home.hasMealOrCheckup,
    surveyLoading,
    surveyCount: surveyHistory.length,
    timedOut,
  })
  useScrollReveal(mode)
  // 효과 측정 — 홈 방문(퍼널 분모), 모드가 정해진 뒤 모드별 1회 · IP/integration/home_measure_v1 M04
  useEffect(() => {
    if (mode !== 'pending') track('home_view', { home_mode: mode })
  }, [mode])

  if (mode === 'pending') {
    return (
      <div className="page">
        <PageMeta />
        <HomePending />
      </div>
    )
  }

  return (
    <div className={`page fade-in${mode === 'visitor' || mode === 'returning' ? ' home-v2' : ''}`}>
      <PageMeta />
      <NewBlogPopup deferUntilPast={mode === 'visitor' ? '.hero-v2__cta' : undefined} />

      {/* ━━ 재설문 유도 배너 (30일 이상 경과 시) ━━ */}
      {resurvey.prompt && (
        <div className="resurvey-banner reveal">
          <div className="resurvey-banner__icon">🔄</div>
          <div className="resurvey-banner__text">
            <strong>건강 변화를 확인해보세요!</strong>
            <span>마지막 분석 후 {resurvey.daysSince}일이 지났어요. 다시 분석하고 변화를 비교해보세요.</span>
          </div>
          <div className="resurvey-banner__actions">
            <Link to="/survey" className="resurvey-banner__btn resurvey-banner__btn--primary">재분석 하기</Link>
            {resurvey.canCompare && (
              <Link to="/health-report" className="resurvey-banner__btn resurvey-banner__btn--secondary">변화 리포트 보기</Link>
            )}
          </div>
        </div>
      )}

      {mode === 'returning' ? (
        <>
          <ReturningHome todayRows={home.todayRows} latestCheckupDate={home.latestCheckupDate} />
          <details className="returning-home__about">
            <summary>서비스 소개 보기</summary>
            <Journey />
            <Experts />
          </details>
        </>
      ) : (
        <VisitorHome mode={mode} />
      )}
    </div>
  )
}

/* ── 첫 렌더 자리 표시(로그인 판정 중) — 재방문 홈 모양 · 문구는 스크린리더용만 ── */
export function HomePending() {
  return (
    <section className="returning-home home-pending" aria-busy="true" data-testid="home-pending">
      <span className="sr-only">불러오는 중</span>
      <div className="home-pending__bar home-pending__bar--title" />
      <div className="home-pending__bar home-pending__bar--card" />
      <div className="home-pending__bar home-pending__bar--card" />
    </section>
  )
}

/* FAQ 아코디언 컴포넌트 */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`faq-item ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="faq-question">
        <span>{q}</span>
        <span className="faq-toggle">{open ? '−' : '+'}</span>
      </div>
      {open && <div className="faq-answer">{a}</div>}
    </div>
  )
}
