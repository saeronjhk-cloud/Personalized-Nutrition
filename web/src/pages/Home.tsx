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
import MealDemo from '../components/home/MealDemo'
import { useSurveyHistory } from '../lib/surveyHistoryRemote'
import { useHomeData } from '../lib/homeData'
import { track } from '../lib/events'
import { resurveyState } from '../domain/survey/history'
import { homeMode, type HomeMode } from '../domain/home/home_mode'
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
    <section className="section-alt-bg">
      <div className="content-section section-animate" style={{ paddingBottom: 'var(--space-8)' }}>
        <div className="section-category">하나의 흐름</div>
        <h2 className="section-title" style={{ textAlign: 'center' }}>먹고, 기록하고, 이해하고, 관리합니다</h2>
        <div className="journey-grid">
          {steps.map((s, i) => (
            <Link key={s.k} to={s.to} className="journey-step">
              <span className="journey-step__k">{String(i + 1).padStart(2, '0')} · {s.k}</span>
              <span className="journey-step__t">{s.t}</span>
              <span className="journey-step__d">{s.d}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── 전문가 (현행 표기 그대로 — 숫자 카운트업은 홈에서 뺌, /team 에 상세) ── */
function Experts() {
  return (
    <section className="content-section section-animate" style={{ paddingTop: 'var(--space-12)' }}>
      <div className="section-category">전문가 팀</div>
      <h2 className="section-title" style={{ textAlign: 'center' }}>식품영양학 박사가 설계한 알고리즘</h2>
      <div className="expert-grid">
        <div className="expert-card">
          <img src="/team-kim.jpg" alt="김재환" className="expert-avatar-img" style={{ objectPosition: '65% 20%' }} />
          <div className="expert-info">
            <div className="expert-name">김재환 <span className="expert-role">대표</span></div>
            <div className="expert-cred">식품영양학 박사 · 특허 14건 · 2019 대통령 표창</div>
          </div>
        </div>
        <div className="expert-card">
          <img src="/team-seo.jpg" alt="서형주" className="expert-avatar-img" />
          <div className="expert-info">
            <div className="expert-name">서형주 <span className="expert-role">자문</span></div>
            <div className="expert-cred">고려대 교수 역임 · 일본 RIKEN 연구원 · 수면과학 전문</div>
          </div>
        </div>
        <div className="expert-card">
          <img src="/team-jang.jpg" alt="장은재" className="expert-avatar-img" />
          <div className="expert-info">
            <div className="expert-name">장은재 <span className="expert-role">자문</span></div>
            <div className="expert-cred">동덕여대 교수 역임 · 비만연구센터장 · 임상영양 전문</div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
        <Link to="/team" className="text-link">팀 소개 자세히 보기 →</Link>
      </div>
    </section>
  )
}

function VisitorHome({ mode }: { mode: HomeMode }) {
  return (
    <>
      {/* ━━ Hero — 대표 CTA 1개 (H10) ━━ */}
      <section className="hero-section hero-home">
        <div className="section-category" style={{ textAlign: 'center' }}>서박사의 영양공식</div>
        <h1>오늘 먹은 것부터,<br /><span className="hero-accent">내 몸에 필요한 것까지</span></h1>
        <p className="hero-sub">
          사진 한 장, 3분 설문, 건강검진 — 편한 것부터 시작하면
          식단과 건강기능식품을 코칭해 드려요.
        </p>
        <StartChooser mode={mode} cta="start" />
        {MEOKSEON_ENABLED && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Link to="/scan" className="text-link" onClick={() => track('home_cta_click', { home_mode: mode, cta: 'scan_link' })}>
              가공식품 성분부터 보기 →
            </Link>
          </div>
        )}
        <div className="hero-trust-line">식품영양학 박사가 설계한 알고리즘 · 김재환 대표 · 서형주 자문 · 장은재 자문</div>
      </section>

      {/* ━━ 10초 밥상 데모 (P1 · home_demo_eval_v1) ━━ */}
      {MEAL_ENABLED && <MealDemo />}

      <Journey />
      <Experts />

      {/* ━━ FAQ 3 ━━ */}
      <section className="content-section section-animate" style={{ paddingTop: 'var(--space-12)' }}>
        <div className="section-category">자주 묻는 질문</div>
        <h2 className="section-title" style={{ textAlign: 'center' }}>궁금한 점이 있으신가요?</h2>
        <div className="faq-list">
          <FaqItem q="정말 무료인가요?" a="네, 무료입니다. 맞춤 영양제 분석과 결과 확인, PDF 저장은 회원가입 없이도 쓸 수 있어요. 식사 기록·건강 기록처럼 이어서 보관하는 기능은 로그인 후 사용합니다. 추천된 영양제를 구매하실 때만 외부 쇼핑몰에서 직접 결제하시면 됩니다." />
          <FaqItem q="내 개인 정보가 저장되나요?" a="맞춤 영양제 설문 분석은 브라우저 안에서만 처리되며, 서버로 전송하지 않습니다. 식사 기록·내 건강 기록처럼 데이터를 이어서 보관하는 기능은 로그인한 내 계정에 저장되며, 언제든 직접 확인하고 관리할 수 있습니다." />
          <FaqItem q="의학적 진단을 대체할 수 있나요?" a="아닙니다. 서박사의 영양공식은 식단과 건강기능식품 선택을 돕는 참고 도구이며, 질환의 진단이나 치료를 대체하지 않습니다. 건강에 이상이 있으시면 반드시 전문의와 상담하세요." />
        </div>
      </section>

      {/* ━━ 최종 CTA (대표 CTA 와 같은 동작) ━━ */}
      <section className="final-cta final-cta-with-img">
        <img src="/supp-fruits.jpg" alt="" className="final-cta-bg" aria-hidden="true" />
        <div className="final-cta-content">
          <h2>오늘 한 끼부터 시작해 보세요</h2>
          <p>사진 한 장이든 3분 설문이든, 편한 것 하나면 충분해요.</p>
          <StartChooser mode={mode} cta="final" />
          <div className="cta-disclaimer">
            본 서비스는 의학적 진단을 대체하지 않습니다. 질환이 있으신 분은 전문의와 상담하세요.
          </div>
        </div>
      </section>
    </>
  )
}

export default function Home() {
  // 로그인 사용자는 서버 설문 기록 우선(다른 기기·주소에서도 보이게) — IP/integration/survey_history_server_eval_v1.md
  const { history: surveyHistory } = useSurveyHistory()
  const resurvey = resurveyState(surveyHistory, new Date())
  const home = useHomeData()
  const mode = homeMode({ isLoggedIn: home.isLoggedIn, hasAnyRecord: home.hasMealOrCheckup || surveyHistory.length > 0 })
  useScrollReveal(mode)

  return (
    <div className="page fade-in">
      <PageMeta />
      <NewBlogPopup />

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
          <ReturningHome todayRows={home.todayRows} />
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
