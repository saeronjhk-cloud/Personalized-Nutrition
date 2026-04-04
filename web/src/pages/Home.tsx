import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="page fade-in">
      {/* ━━ 히어로 섹션 ━━ */}
      <section className="hero-section hero-home">
        <div className="hero-badge">식약처 인정 건강기능식품 기반</div>
        <h1>
          3분 안에 찾는<br />
          <span className="hero-accent">나만의 맞춤 영양제</span>
        </h1>
        <p className="hero-sub">
          36가지 신체 신호와 라이프스타일을 AI가 교차 분석하여<br />
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
      </section>

      {/* ━━ 신뢰 지표 바 ━━ */}
      <section className="stats-bar">
        <div className="stats-inner">
          <div className="stat-item">
            <div className="stat-number">30<span className="stat-unit">종</span></div>
            <div className="stat-label">분석 대상 영양제</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number">14<span className="stat-unit">개</span></div>
            <div className="stat-label">건강 카테고리</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number">36<span className="stat-unit">가지</span></div>
            <div className="stat-label">신체 증상 교차 분석</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number">13<span className="stat-unit">개</span></div>
            <div className="stat-label">질환 안전성 검증</div>
          </div>
        </div>
      </section>

      {/* ━━ 문제 제기 섹션 ━━ */}
      <section className="content-section" style={{ paddingTop: 48 }}>
        <div className="section-eyebrow">WHY CARE & N</div>
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          영양제, 아직도 감으로 고르시나요?
        </h2>
        <p className="section-desc">
          한국인의 70% 이상이 1가지 이상의 영양소가 부족하지만,
          대부분 자신에게 필요한 영양제가 무엇인지 모릅니다.
          광고나 주변 추천에 의존한 선택은 효과도 없고 돈만 낭비될 수 있습니다.
        </p>
      </section>

      {/* ━━ 작동 방식 ━━ */}
      <section className="content-section">
        <div className="section-eyebrow">HOW IT WORKS</div>
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
            <h3>AI 교차 분석</h3>
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

      {/* ━━ 핵심 차별점 ━━ */}
      <section className="content-section" style={{ background: 'var(--bg)', padding: '48px 20px', borderRadius: 'var(--radius)' }}>
        <div className="section-eyebrow">WHAT MAKES US DIFFERENT</div>
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          케어앤만의 차별점
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

      {/* ━━ 전문가 소개 ━━ */}
      <section className="content-section" style={{ paddingTop: 48 }}>
        <div className="section-eyebrow">EXPERT TEAM</div>
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          식품영양학 박사가 설계한 알고리즘
        </h2>
        <p className="section-desc">
          20년 이상의 건강기능식품 연구 경력을 가진 전문가 팀이
          추천 로직을 설계하고 검증합니다.
        </p>
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
      </section>

      {/* ━━ 비교 테이블 ━━ */}
      <section className="content-section">
        <div className="section-eyebrow">COMPARISON</div>
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          기존 방식 vs 케어앤
        </h2>
        <div className="compare-table">
          <div className="compare-header">
            <div className="compare-col">항목</div>
            <div className="compare-col compare-old">약국·지인 추천</div>
            <div className="compare-col compare-new">케어앤</div>
          </div>
          {[
            ['분석 기준', '문진 몇 가지', '36가지 증상 + 생활습관 + 질환'],
            ['안전성 검증', '약사 경험 의존', '13개 질환 × 30종 성분 자동 교차 검증'],
            ['개인화 수준', '연령·성별 정도', '15개 페르소나 + BMI/BMR 계산'],
            ['비용 투명성', '매장 가격만', '월간 예상 비용 + 쿠팡 최저가 비교'],
            ['근거', '브랜드 마케팅', '식약처 인정 기능성 + 논문 기반'],
          ].map(([item, old, care], i) => (
            <div key={i} className="compare-row">
              <div className="compare-col compare-item">{item}</div>
              <div className="compare-col compare-old">{old}</div>
              <div className="compare-col compare-new">{care}</div>
            </div>
          ))}
        </div>
      </section>

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
