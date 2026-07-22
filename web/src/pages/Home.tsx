import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import PageMeta from '../components/PageMeta'
import NewBlogPopup from '../components/NewBlogPopup'
import { shouldPromptResurvey, daysSinceLastSurvey, getSurveyHistory } from '../lib/surveyHistory'
import { MEOKSEON_ENABLED, MEAL_ENABLED, CHECKUP_ENABLED } from '../lib/flags'

/* ── 스크롤 시 .visible 추가 훅 (개별 요소용) ── */
function useScrollReveal() {
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
  }, [])
}

/* ── 숫자 카운트업 컴포넌트 ── */
function CountUp({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 1500
          const startTime = Date.now()
          const tick = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setValue(Math.round(eased * end))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [end])

  return <span ref={ref} className="count-up">{value.toLocaleString()}{suffix}</span>
}

export default function Home() {
  useScrollReveal()

  return (
    <div className="page fade-in">
      <PageMeta />
      <NewBlogPopup />

      {/* ━━ 재설문 유도 배너 (30일 이상 경과 시) ━━ */}
      {shouldPromptResurvey() && (
        <div className="resurvey-banner reveal">
          <div className="resurvey-banner__icon">🔄</div>
          <div className="resurvey-banner__text">
            <strong>건강 변화를 확인해보세요!</strong>
            <span>마지막 분석 후 {daysSinceLastSurvey()}일이 지났어요. 다시 분석하고 변화를 비교해보세요.</span>
          </div>
          <div className="resurvey-banner__actions">
            <Link to="/survey" className="resurvey-banner__btn resurvey-banner__btn--primary">재분석 하기</Link>
            {getSurveyHistory().length >= 2 && (
              <Link to="/health-report" className="resurvey-banner__btn resurvey-banner__btn--secondary">변화 리포트 보기</Link>
            )}
          </div>
        </div>
      )}

      {/* ━━ 4기능 허브 — 앱 진입점 (우선순위: 먹선 → NutriLens → 건강진단 → 영양제) ━━ */}
      <section className="feature-hub section-animate">
        <div className="section-category" style={{ textAlign: 'center' }}>서박사의 영양공식</div>
        <h2 className="feature-hub-title">먹는 것부터 챙기는 것까지, 한&nbsp;곳에서</h2>
        <p className="feature-hub-sub">
          가공식품 성분을 확인하고, 식사를 기록하고, 내 건강 데이터를 모아
          — 나에게 맞는 영양제까지. 흩어져 있던 건강 관리를 하나로 모았습니다.
        </p>
        <div className="feature-hub-grid">
          {MEOKSEON_ENABLED && (
            <Link to="/scan" className="feature-hub-card">
              <span className="feature-hub-icon" style={{ background: '#e0f2fe' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/></svg>
              </span>
              <div className="feature-hub-body">
                <div className="feature-hub-name">가공식품 영양정보</div>
                <div className="feature-hub-desc">가공식품 성분·첨가물·영양을 10초 만에 해석 · 무료</div>
              </div>
              <span className="feature-hub-arrow">→</span>
            </Link>
          )}

          {MEAL_ENABLED && (
            <Link to="/meal" className="feature-hub-card">
              <span className="feature-hub-icon" style={{ background: '#fef3c7' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/></svg>
              </span>
              <div className="feature-hub-body">
                <div className="feature-hub-name">식사 기록</div>
                <div className="feature-hub-desc">사진 한 장으로 칼로리·영양을 자동 분석해요</div>
              </div>
              <span className="feature-hub-arrow">→</span>
            </Link>
          )}

          {CHECKUP_ENABLED && (
            <Link to="/dashboard" className="feature-hub-card">
              <span className="feature-hub-icon" style={{ background: '#fce7f3' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#be185d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/><path d="M8 14h2l1-2 1.5 3 1-1H16"/></svg>
              </span>
              <div className="feature-hub-body">
                <div className="feature-hub-name">내 건강 기록</div>
                <div className="feature-hub-desc">건강검진·설문 등 내 건강 정보를 한곳에서 기록하고 관리해요</div>
              </div>
              <span className="feature-hub-arrow">→</span>
            </Link>
          )}

          <Link to="/survey" className="feature-hub-card">
            <span className="feature-hub-icon" style={{ background: '#e8f5e3' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="M8.5 8.5l7 7"/></svg>
            </span>
            <div className="feature-hub-body">
              <div className="feature-hub-name">맞춤 영양제 추천</div>
              <div className="feature-hub-desc">3분 설문으로 나에게 맞는 영양제 조합을 찾아드려요</div>
            </div>
            <span className="feature-hub-arrow">→</span>
          </Link>
        </div>
      </section>

      {/* ━━ 핵심 기능 1 — 가공식품 영양정보 ━━ */}
      {MEOKSEON_ENABLED && (
        <section className="section-alt-bg">
          <div className="content-section section-animate" style={{ paddingBottom: 32 }}>
            <div className="section-category">핵심 기능 · 가공식품 영양정보</div>
            <h2 className="section-title" style={{ textAlign: 'center' }}>
              내가 먹는 가공식품, 10초 해석
            </h2>
            <p className="section-desc">
              성분표는 작고, 첨가물 이름은 어렵습니다.
              바코드를 스캔하거나 제품명을 검색하면 첨가물과 영양성분을 쉬운 말로 풀어드립니다.
            </p>
            <div className="steps-grid">
              <div className="step-card">
                <div className="step-number">01</div>
                <h3>스캔 또는 검색</h3>
                <p>바코드를 비추거나 제품명으로 검색합니다</p>
              </div>
              <div className="step-arrow">→</div>
              <div className="step-card">
                <div className="step-number">02</div>
                <h3>첨가물·영양 해석</h3>
                <p>첨가물 종류와 영양성분을 알기 쉽게 설명합니다</p>
              </div>
              <div className="step-arrow">→</div>
              <div className="step-card">
                <div className="step-number">03</div>
                <h3>내 기준으로 보기</h3>
                <p>내 건강 상태를 기준으로 다시 살펴볼 수 있습니다</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Link to="/scan" className="btn btn-primary" style={{ maxWidth: 300, margin: '0 auto' }}>
                제품 해석해보기 →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ━━ 핵심 기능 2 — 식사 기록 ━━ */}
      {MEAL_ENABLED && (
        <section className="content-section section-animate" style={{ paddingTop: 48 }}>
          <div className="section-category">핵심 기능 · 식사 기록</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>
            사진 한 장이면 식사 기록 끝
          </h2>
          <p className="section-desc">
            매 끼니 일일이 입력할 필요 없습니다.
            사진을 올리면 칼로리와 영양이 자동으로 분석되고, 일주일 식습관을 리포트로 돌아볼 수 있습니다.
          </p>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">01</div>
              <h3>사진으로 기록</h3>
              <p>식사 사진 한 장을 올리고 먹은 양만 조절합니다</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">02</div>
              <h3>자동 영양 분석</h3>
              <p>칼로리와 영양성분을 자동으로 계산합니다</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">03</div>
              <h3>주간 리포트</h3>
              <p>일주일 단위로 내 식습관의 흐름을 확인합니다</p>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link to="/meal" className="btn btn-primary" style={{ maxWidth: 300, margin: '0 auto' }}>
              오늘 식사 기록하기 →
            </Link>
          </div>
        </section>
      )}

      {/* ━━ 핵심 기능 3 — 내 건강 기록 ━━ */}
      {CHECKUP_ENABLED && (
        <section className="section-alt-bg">
          <div className="content-section section-animate" style={{ paddingBottom: 32 }}>
            <div className="section-category">핵심 기능 · 내 건강 기록</div>
            <h2 className="section-title" style={{ textAlign: 'center' }}>
              흩어져 있던 건강 데이터를 한곳에
            </h2>
            <p className="section-desc">
              건강검진 결과, 증상과 건강 목표를 한곳에 모아 관리합니다.
              쌓인 기록은 나에게 맞는 추천의 기반이 됩니다.
            </p>
            <div className="steps-grid">
              <div className="step-card">
                <div className="step-number">01</div>
                <h3>건강검진 기록</h3>
                <p>검진 결과를 기록하고 언제든 다시 확인합니다</p>
              </div>
              <div className="step-arrow">→</div>
              <div className="step-card">
                <div className="step-number">02</div>
                <h3>증상·목표 기록</h3>
                <p>지금 느끼는 증상과 건강 목표를 함께 관리합니다</p>
              </div>
              <div className="step-arrow">→</div>
              <div className="step-card">
                <div className="step-number">03</div>
                <h3>맞춤 추천 연결</h3>
                <p>내 기록을 바탕으로 맞춤 추천을 받아볼 수 있습니다</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Link to="/dashboard" className="btn btn-primary" style={{ maxWidth: 300, margin: '0 auto' }}>
                내 건강 기록 시작하기 →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ━━ 핵심 기능 4 — 맞춤 영양제 추천 ━━ */}
      <section className="content-section section-animate section-with-bg" style={{ paddingTop: 48 }}>
        <img src="/supp-fitness.jpg" alt="" className="section-bg-img" aria-hidden="true" />
        <div className="section-category">핵심 기능 · 맞춤 영양제 추천</div>
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          3단계로 완성되는 맞춤 추천
        </h2>
        <p className="section-desc">
          36가지 증상과 생활습관을 교차 분석해, 식약처가 기능성을 인정한 성분 중에서
          기저질환·복용 약물과의 충돌까지 검증한 조합을 추천합니다.
        </p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <h3>건강 설문</h3>
            <p>신체 정보, 증상, 생활습관, 기저질환까지 10가지 항목을 체크합니다</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">02</div>
            <h3>교차 분석</h3>
            <p>15개 페르소나, 14개 카테고리, 약물 상호작용까지 자동 검증합니다</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">03</div>
            <h3>맞춤 리포트</h3>
            <p>복용법, 주의사항, 예상 비용과 함께 PDF로 저장할 수 있습니다</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/survey" className="btn btn-primary" style={{ maxWidth: 300, margin: '0 auto' }}>
            무료 맞춤 분석 시작하기 →
          </Link>
        </div>
      </section>

      {/* ━━ 전문가 소개 + 연구 깊이 — 풀폭 배경 ━━ */}
      <section className="section-alt-bg">
        <div className="content-section section-animate" style={{ paddingBottom: 0 }}>
          <div className="section-category">전문가 팀</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>
            식품영양학 박사가 설계한 알고리즘
          </h2>
          <p className="section-desc">
            20년 이상의 건강기능식품 연구 경력을 가진 전문가 팀이
            추천 로직을 설계하고 검증합니다.
          </p>

          <div className="research-stats">
            <div className="research-stat">
              <div className="research-number"><CountUp end={120} suffix="+" /></div>
              <div className="research-label">참조 논문 및 가이드라인</div>
            </div>
            <div className="research-stat">
              <div className="research-number"><CountUp end={390} suffix="+" /></div>
              <div className="research-label">성분 간 상호작용 검증 규칙</div>
            </div>
            <div className="research-stat">
              <div className="research-number"><CountUp end={14} /><span className="research-unit">건</span></div>
              <div className="research-label">대표 보유 특허</div>
            </div>
          </div>

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
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/team" className="text-link">팀 소개 자세히 보기 →</Link>
          </div>
        </div>
      </section>

      {/* ━━ 건강 추적 기능 소개 ━━ */}
      <section className="health-tracking-section section-animate">
        <div className="section-category">건강 추적</div>
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          꾸준히 관리하면, 변화가 보입니다
        </h2>
        <p className="section-subtitle" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 32 }}>
          분석 결과를 자동 저장하고, 다음 분석과 비교해드려요
        </p>

        <div className="health-tracking-steps-home">
          <div className="health-tracking-step-home">
            <div className="health-tracking-step-home__num">1</div>
            <div className="health-tracking-step-home__icon">🧬</div>
            <h4>맞춤 분석 받기</h4>
            <p>3분 설문으로 나에게 필요한 영양제를 확인하세요. 결과는 자동 저장됩니다.</p>
          </div>
          <div className="health-tracking-step-home__arrow">→</div>
          <div className="health-tracking-step-home">
            <div className="health-tracking-step-home__num">2</div>
            <div className="health-tracking-step-home__icon">💊</div>
            <h4>영양제 꾸준히 섭취</h4>
            <p>추천받은 영양제를 30~90일간 꾸준히 복용해보세요.</p>
          </div>
          <div className="health-tracking-step-home__arrow">→</div>
          <div className="health-tracking-step-home">
            <div className="health-tracking-step-home__num">3</div>
            <div className="health-tracking-step-home__icon">📊</div>
            <h4>건강 변화 확인</h4>
            <p>다시 분석하면 이전과 비교한 건강 변화 리포트를 받아볼 수 있어요.</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/survey" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            첫 분석 시작하기 →
          </Link>
        </div>
      </section>

      {/* ━━ FAQ ━━ */}
      <section className="content-section section-animate" style={{ paddingTop: 48 }}>
        <div className="section-category">자주 묻는 질문</div>
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          궁금한 점이 있으신가요?
        </h2>
        <div className="faq-list">
          <FaqItem q="정말 무료인가요?" a="네, 100% 무료입니다. 분석, 결과 확인, PDF 저장까지 모두 무료이며 회원가입도 필요 없습니다. 추천된 영양제를 구매하실 때만 쿠팡 등 외부 쇼핑몰에서 직접 결제하시면 됩니다." />
          <FaqItem q="내 개인 정보가 저장되나요?" a="맞춤 영양제 설문 분석은 브라우저 안에서만 처리되며, 서버로 전송하지 않습니다. 식사 기록·내 건강 기록처럼 데이터를 이어서 보관하는 기능은 로그인한 내 계정에 저장되며, 언제든 직접 확인하고 관리할 수 있습니다." />
          <FaqItem q="약을 먹고 있는데 써도 되나요?" a="네, 오히려 그런 분들에게 더 유용합니다. 설문에서 현재 복용 중인 약물과 기저질환을 체크하면, 충돌 가능성이 있는 성분을 자동으로 제외합니다." />
          <FaqItem q="추천 결과를 어떻게 활용하나요?" a="결과 리포트에서 각 영양제의 복용법, 주의사항, 월간 비용을 확인하고, 쿠팡 링크를 통해 바로 구매하실 수 있습니다. PDF로 저장해서 약사나 의사와 상담할 때 참고 자료로도 활용 가능합니다." />
          <FaqItem q="의학적 진단을 대체할 수 있나요?" a="아닙니다. 서박사의 영양공식은 건강기능식품 선택을 돕는 참고 도구이며, 질환의 진단이나 치료를 대체하지 않습니다. 건강에 이상이 있으시면 반드시 전문의와 상담하세요." />
        </div>
      </section>

      {/* ━━ 최종 CTA ━━ */}
      <section className="final-cta final-cta-with-img">
        <img src="/supp-fruits.jpg" alt="" className="final-cta-bg" aria-hidden="true" />
        <div className="final-cta-content">
        <h2>먹는 것부터 챙기는 것까지, 지금 시작해보세요</h2>
        <p>맞춤 영양제 분석은 회원가입 없이 3분이면 끝납니다. 결과는 PDF로 저장할 수 있어요.</p>
        <Link to="/survey" className="btn btn-primary hero-cta">
          무료 맞춤 분석 시작하기 →
        </Link>
        <div style={{ marginTop: 12 }}>
          {MEOKSEON_ENABLED && (
            <Link to="/scan" className="text-link" style={{ color: 'inherit' }}>
              가공식품 영양정보부터 써보기 →
            </Link>
          )}
        </div>
        <div className="cta-disclaimer">
          본 서비스는 의학적 진단을 대체하지 않습니다. 질환이 있으신 분은 전문의와 상담하세요.
        </div>
        </div>
      </section>
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
