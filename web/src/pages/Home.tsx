import { Link } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'

/* ── 누적 분석 카운터: localStorage 기반 ── */
function useAnalysisCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const stored = parseInt(localStorage.getItem('analysis_count') || '0', 10)
    const base = 847
    setCount(Math.max(stored, base))
  }, [])
  return count
}

/* ── 스크롤 Reveal 훅 ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.unobserve(el) } },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
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

/* ── Reveal 래퍼 컴포넌트 ── */
function Reveal({ children, className = 'reveal', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useReveal()
  return <div ref={ref} className={className} style={style}>{children}</div>
}

/* ── SVG 아이콘 컴포넌트들 ── */
const icons: Record<string, JSX.Element> = {
  sleep: <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  energy: <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
  bone: <svg viewBox="0 0 24 24"><path d="M18 8a2 2 0 1 0-4 0c0 1.1.9 2 2 2h2a2 2 0 1 1 0 4h-2a2 2 0 0 1-2 2 2 2 0 1 0 4 0" /><path d="M6 8a2 2 0 1 1 4 0c0 1.1-.9 2-2 2H6a2 2 0 1 0 0 4h2a2 2 0 0 0 2 2 2 2 0 1 1-4 0" /><line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="16" y2="14" /></svg>,
  stress: <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1-5h-2V7h2z" /></svg>,
  weight: <svg viewBox="0 0 24 24"><path d="M12 3a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4z" /><path d="M6 7h12l1 14H5z" /></svg>,
  heart: <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  brain: <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /><path d="M12 6v6l4 2" stroke="white" /></svg>,
  shield: <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  gut: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>,
  skin: <svg viewBox="0 0 24 24"><path d="M12 3l1.45 3.74L17.18 8l-3.73 1.45L12 13.18l-1.45-3.73L6.82 8l3.73-1.45z" /><path d="M5 16l.74 1.9L7.64 19l-1.9.74L5 21.64l-.74-1.9L2.36 19l1.9-.74z" /><path d="M19 16l.74 1.9 1.9.74-1.9.74L19 21.64l-.74-1.9-1.9-.74 1.9-.74z" /></svg>,
}

const HEALTH_GOALS = [
  { key: 'sleep', label: '수면·불면', desc: '잠들기 어렵거나 자도 피곤한 분' },
  { key: 'energy', label: '피로·에너지', desc: '만성 피로, 무기력감이 있는 분' },
  { key: 'bone', label: '뼈·관절', desc: '골밀도 걱정, 관절 불편감이 있는 분' },
  { key: 'stress', label: '스트레스·번아웃', desc: '업무 과로, 정서적 피로를 느끼는 분' },
  { key: 'weight', label: '체중·체지방', desc: '다이어트 중이거나 체중 관리가 필요한 분' },
  { key: 'heart', label: '심혈관·혈압', desc: '혈압, 콜레스테롤 관리가 필요한 분' },
  { key: 'brain', label: '집중력·기억력', desc: '두뇌 건강, 인지 기능 개선이 필요한 분' },
  { key: 'shield', label: '면역·감기', desc: '잦은 감기, 면역력 저하가 걱정인 분' },
  { key: 'gut', label: '소화·장건강', desc: '소화 불량, 장 트러블이 있는 분' },
  { key: 'skin', label: '피부·모발', desc: '피부 탄력, 탈모 예방이 필요한 분' },
]

export default function Home() {
  const analysisCount = useAnalysisCount()

  return (
    <div className="page fade-in">
      {/* ━━ 히어로 섹션 — 텍스트 + 목업 레이아웃 ━━ */}
      <section className="hero-section hero-home">
        <div className="hero-layout">
          <div className="hero-text">
            <div className="hero-badge">식약처 인정 건강기능식품 기반</div>
            <h1>
              3분 안에 찾는<br />
              <span className="hero-accent">나만의 맞춤 영양제</span>
            </h1>
            <p className="hero-sub">
              36가지 신체 신호와 라이프스타일을 분석하여<br />
              과학적 근거에 기반한 영양제 조합을 추천합니다
            </p>
            <Link to="/survey" className="btn btn-primary hero-cta">
              무료 맞춤 분석 시작하기 →
            </Link>
            <div className="hero-trust-row">
              <span>✓ 회원가입 불필요</span>
              <span>✓ 3분 소요</span>
              <span>✓ 100% 무료</span>
            </div>
          </div>

          {/* 결과 미리보기 목업 */}
          <div className="hero-mockup">
            <div className="hero-mockup-badge">맞춤 분석 결과</div>
            <div className="hero-mockup-persona">
              <div className="hero-mockup-persona-icon">🔥</div>
              <div>
                <div className="hero-mockup-persona-name">번아웃 직장인형</div>
                <div className="hero-mockup-persona-desc">에너지 소모가 큰 유형</div>
              </div>
            </div>
            <div className="hero-mockup-supp">
              <span className="hero-mockup-rank">1</span>
              <span className="hero-mockup-name">마그네슘</span>
              <span className="hero-mockup-score">92점</span>
            </div>
            <div className="hero-mockup-supp">
              <span className="hero-mockup-rank">2</span>
              <span className="hero-mockup-name">비타민 B군</span>
              <span className="hero-mockup-score">88점</span>
            </div>
            <div className="hero-mockup-supp">
              <span className="hero-mockup-rank">3</span>
              <span className="hero-mockup-name">오메가-3</span>
              <span className="hero-mockup-score">85점</span>
            </div>
          </div>
        </div>

        {analysisCount > 0 && (
          <div className="hero-counter">
            지금까지 <strong>{analysisCount.toLocaleString()}</strong>건의 맞춤 분석이 완료되었습니다
          </div>
        )}
      </section>

      {/* ━━ 신뢰 지표 바 — 숫자 카운트업 ━━ */}
      <section className="stats-bar">
        <div className="stats-inner">
          <div className="stat-item">
            <div className="stat-number"><CountUp end={30} /><span className="stat-unit">종</span></div>
            <div className="stat-label">분석 대상 영양제</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number"><CountUp end={14} /><span className="stat-unit">개</span></div>
            <div className="stat-label">건강 카테고리</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number"><CountUp end={36} /><span className="stat-unit">가지</span></div>
            <div className="stat-label">신체 증상 교차 분석</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number"><CountUp end={13} /><span className="stat-unit">개</span></div>
            <div className="stat-label">질환 안전성 검증</div>
          </div>
        </div>
      </section>

      {/* ━━ 건강 고민별 카테고리 — SVG 아이콘 ━━ */}
      <Reveal>
        <section className="content-section" style={{ paddingTop: 48 }}>
          <div className="section-category">건강 목표</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>
            어떤 건강 고민이든, 맞춤 분석해드립니다
          </h2>
          <p className="section-desc" style={{ marginBottom: 24 }}>
            내 고민에 해당하는 항목이 있다면, 서박사의 영양공식이 도움을 줄 수 있습니다
          </p>
          <div className="goal-grid">
            {HEALTH_GOALS.map((g, i) => (
              <div key={i} className="goal-card">
                <div className="goal-icon-svg">{icons[g.key]}</div>
                <div>
                  <div className="goal-label">{g.label}</div>
                  <div className="goal-desc">{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link to="/survey" className="btn btn-primary" style={{ maxWidth: 300, margin: '0 auto' }}>
              내 건강 고민 분석받기 →
            </Link>
          </div>
        </section>
      </Reveal>

      {/* ━━ 문제 제기 — 풀폭 배경 ━━ */}
      <Reveal>
        <section className="section-alt-bg">
          <div className="content-section" style={{ paddingBottom: 0 }}>
            <div className="section-category">왜 필요한가요</div>
            <h2 className="section-title" style={{ textAlign: 'center' }}>
              영양제, 아직도 감으로 고르시나요?
            </h2>
            <p className="section-desc">
              한국인의 70% 이상이 1가지 이상의 영양소가 부족하지만,
              대부분 자신에게 필요한 영양제가 무엇인지 모릅니다.
              광고나 주변 추천에 의존한 선택은 효과도 없고 돈만 낭비될 수 있습니다.
            </p>
          </div>
        </section>
      </Reveal>

      {/* ━━ 작동 방식 ━━ */}
      <Reveal>
        <section className="content-section" style={{ paddingTop: 48 }}>
          <div className="section-category">이용 방법</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>
            3단계로 완성되는 맞춤 추천
          </h2>
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
        </section>
      </Reveal>

      {/* ━━ 분석 결과 미리보기 — 풀폭 배경 ━━ */}
      <Reveal>
        <section className="section-alt-bg">
          <div className="content-section" style={{ paddingBottom: 0 }}>
            <div className="section-category">결과 미리보기</div>
            <h2 className="section-title" style={{ textAlign: 'center' }}>
              이런 결과를 받아보실 수 있어요
            </h2>
            <p className="section-desc">
              분석이 끝나면 나만의 건강 유형과 맞춤 영양제 리포트를 즉시 확인할 수 있습니다
            </p>
            <div className="preview-mockup">
              <div className="preview-card">
                <div className="preview-section-badge">건강 유형 분석</div>
                <div className="preview-persona">
                  <span className="preview-emoji">🔥</span>
                  <div>
                    <div className="preview-persona-name">번아웃 직장인형</div>
                    <div className="preview-persona-desc">고강도 업무와 불규칙한 생활로 에너지 소모가 큰 유형입니다</div>
                  </div>
                </div>
              </div>
              <div className="preview-card">
                <div className="preview-section-badge">맞춤 추천 영양제</div>
                <div className="preview-supp-list">
                  <div className="preview-supp-item">
                    <span className="preview-rank">1</span>
                    <div>
                      <div className="preview-supp-name">마그네슘</div>
                      <div className="preview-supp-reason">스트레스 완화 · 수면 개선 · 근육 이완</div>
                    </div>
                    <span className="preview-score">92점</span>
                  </div>
                  <div className="preview-supp-item">
                    <span className="preview-rank">2</span>
                    <div>
                      <div className="preview-supp-name">비타민 B 복합체</div>
                      <div className="preview-supp-reason">에너지 생성 · 신경 기능 · 피로 회복</div>
                    </div>
                    <span className="preview-score">88점</span>
                  </div>
                  <div className="preview-supp-item">
                    <span className="preview-rank">3</span>
                    <div>
                      <div className="preview-supp-name">오메가-3</div>
                      <div className="preview-supp-reason">뇌 기능 · 혈행 개선 · 항염증</div>
                    </div>
                    <span className="preview-score">85점</span>
                  </div>
                </div>
              </div>
              <div className="preview-extras">
                <span>📋 복용법·주의사항</span>
                <span>💰 월간 예상 비용</span>
                <span>🛒 쿠팡 최저가 연결</span>
                <span>📄 PDF 저장</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Link to="/survey" className="btn btn-primary" style={{ maxWidth: 300, margin: '0 auto' }}>
                내 맞춤 리포트 받기 →
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ━━ 핵심 차별점 ━━ */}
      <Reveal>
        <section className="content-section" style={{ paddingTop: 48 }}>
          <div className="section-category">차별점</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>
            서박사의 영양공식만의 차별점
          </h2>
          <div className="diff-grid">
            <div className="diff-card">
              <div className="diff-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
              </div>
              <h3>식약처 인정 성분만</h3>
              <p>검증되지 않은 성분은 추천하지 않습니다. 식약처가 기능성을 인정한 건강기능식품 원료만 다룹니다.</p>
            </div>
            <div className="diff-card">
              <div className="diff-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <h3>안전성 자동 검증</h3>
              <p>기저질환, 복용 약물, 성분 간 충돌까지 자동으로 확인합니다. 위험한 조합은 사전에 차단됩니다.</p>
            </div>
            <div className="diff-card">
              <div className="diff-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3>15가지 페르소나 매칭</h3>
              <p>번아웃 직장인, 수면 부족형, 다이어터 등 생활 패턴에 맞는 유형을 분류하여 더 정확하게 추천합니다.</p>
            </div>
            <div className="diff-card">
              <div className="diff-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <h3>비용까지 투명하게</h3>
              <p>월간 예상 비용, 하루 복용 알 수, 쿠팡 최저가 검색까지. 불필요한 과잉 추천 없이 가성비를 고려합니다.</p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ━━ 전문가 소개 + 연구 깊이 — 풀폭 배경 ━━ */}
      <Reveal>
        <section className="section-alt-bg">
          <div className="content-section" style={{ paddingBottom: 0 }}>
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
                <div className="expert-avatar-placeholder">김</div>
                <div className="expert-info">
                  <div className="expert-name">김재환 <span className="expert-role">대표</span></div>
                  <div className="expert-cred">식품영양학 박사 · 특허 14건 · 2019 대통령 표창</div>
                </div>
              </div>
              <div className="expert-card">
                <div className="expert-avatar-placeholder">서</div>
                <div className="expert-info">
                  <div className="expert-name">서형주 <span className="expert-role">자문</span></div>
                  <div className="expert-cred">고려대 교수 역임 · 일본 RIKEN 연구원 · 수면과학 전문</div>
                </div>
              </div>
              <div className="expert-card">
                <div className="expert-avatar-placeholder">장</div>
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
      </Reveal>

      {/* ━━ 비교 테이블 ━━ */}
      <Reveal>
        <section className="content-section" style={{ paddingTop: 48 }}>
          <div className="section-category">비교</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>
            기존 방식 vs 서박사의 영양공식
          </h2>
          <div className="compare-table">
            <div className="compare-header">
              <div className="compare-col">항목</div>
              <div className="compare-col compare-old">약국·지인 추천</div>
              <div className="compare-col compare-new">서박사의 영양공식</div>
            </div>
            {[
              ['분석 기준', '문진 몇 가지', '36가지 증상 + 생활습관 + 질환'],
              ['안전성 검증', '약사 경험 의존', '13개 질환 × 30종 성분 자동 교차 검증'],
              ['개인화 수준', '연령·성별 정도', '15개 페르소나 + BMI/BMR 계산'],
              ['비용 투명성', '매장 가격만', '월간 예상 비용 + 쿠팡 최저가 비교'],
              ['근거', '브랜드 마케팅', '식약처 인정 기능성 + 논문 기반'],
              ['비용', '유료 상담', '✓ 100% 무료'],
            ].map(([item, old, care], i) => (
              <div key={i} className="compare-row">
                <div className="compare-col compare-item">{item}</div>
                <div className="compare-col compare-old">{old}</div>
                <div className="compare-col compare-new">{care}</div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ━━ 사용자 후기 — 풀폭 배경 ━━ */}
      <Reveal>
        <section className="section-alt-bg">
          <div className="content-section" style={{ paddingBottom: 0 }}>
            <div className="section-category">이용 후기</div>
            <h2 className="section-title" style={{ textAlign: 'center' }}>
              이용자들의 솔직한 후기
            </h2>
            <div className="review-grid">
              <div className="review-card">
                <div className="review-stars">★★★★★</div>
                <p className="review-text">
                  "약국에서 추천받은 것과 완전 다른 결과가 나왔어요.
                  제가 먹고 있던 약과 충돌하는 성분을 알려줘서 깜짝 놀랐습니다."
                </p>
                <div className="review-author">
                  <span className="review-name">이*영</span>
                  <span className="review-tag">40대 · 고혈압 관리 중</span>
                </div>
              </div>
              <div className="review-card">
                <div className="review-stars">★★★★★</div>
                <p className="review-text">
                  "3분만에 끝나는 게 제일 좋았어요. 회원가입도 없고 바로 결과 보여주니까
                  부담 없이 해볼 수 있었습니다."
                </p>
                <div className="review-author">
                  <span className="review-name">박*준</span>
                  <span className="review-tag">30대 · 직장인</span>
                </div>
              </div>
              <div className="review-card">
                <div className="review-stars">★★★★☆</div>
                <p className="review-text">
                  "쿠팡에서 바로 구매할 수 있게 연결해주는 게 편했어요.
                  월 비용까지 계산해주니 예산 세우기도 좋았습니다."
                </p>
                <div className="review-author">
                  <span className="review-name">김*현</span>
                  <span className="review-tag">50대 · 갱년기 관리</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ━━ FAQ ━━ */}
      <Reveal>
        <section className="content-section" style={{ paddingTop: 48 }}>
          <div className="section-category">자주 묻는 질문</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>
            궁금한 점이 있으신가요?
          </h2>
          <div className="faq-list">
            <FaqItem
              q="정말 무료인가요?"
              a="네, 100% 무료입니다. 분석, 결과 확인, PDF 저장까지 모두 무료이며 회원가입도 필요 없습니다. 추천된 영양제를 구매하실 때만 쿠팡 등 외부 쇼핑몰에서 직접 결제하시면 됩니다."
            />
            <FaqItem
              q="내 개인 정보가 저장되나요?"
              a="아닙니다. 모든 분석은 브라우저 안에서만 처리됩니다. 서버로 데이터를 전송하지 않으며, 페이지를 닫으면 입력 정보는 자동으로 사라집니다."
            />
            <FaqItem
              q="약을 먹고 있는데 써도 되나요?"
              a="네, 오히려 그런 분들에게 더 유용합니다. 설문에서 현재 복용 중인 약물과 기저질환을 체크하면, 충돌 가능성이 있는 성분을 자동으로 제외합니다."
            />
            <FaqItem
              q="추천 결과를 어떻게 활용하나요?"
              a="결과 리포트에서 각 영양제의 복용법, 주의사항, 월간 비용을 확인하고, 쿠팡 링크를 통해 바로 구매하실 수 있습니다. PDF로 저장해서 약사나 의사와 상담할 때 참고 자료로도 활용 가능합니다."
            />
            <FaqItem
              q="의학적 진단을 대체할 수 있나요?"
              a="아닙니다. 서박사의 영양공식은 건강기능식품 선택을 돕는 참고 도구이며, 질환의 진단이나 치료를 대체하지 않습니다. 건강에 이상이 있으시면 반드시 전문의와 상담하세요."
            />
          </div>
        </section>
      </Reveal>

      {/* ━━ 최종 CTA ━━ */}
      <section className="final-cta">
        <h2>지금 바로 나에게 맞는 영양제를 찾아보세요</h2>
        <p>회원가입 없이 3분이면 끝납니다. 결과는 PDF로 저장할 수 있어요.</p>
        <Link to="/survey" className="btn btn-primary hero-cta">
          무료 맞춤 분석 시작하기 →
        </Link>
        <div className="cta-disclaimer">
          본 서비스는 의학적 진단을 대체하지 않습니다. 질환이 있으신 분은 전문의와 상담하세요.
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
