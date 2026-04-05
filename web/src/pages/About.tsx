import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="page fade-in">
      {/* 히어로 */}
      <section className="hero-section hero-with-img">
        <img src="/supp-wellness.jpg" alt="" className="hero-bg-img" aria-hidden="true" />
        <div className="hero-overlay">
          <h1>바른 먹거리로 건강한 세상을 이룬다</h1>
          <p className="hero-sub">서박사의 영양공식은 과학적 근거에 기반한 맞춤형 건강기능식품 추천 서비스입니다.</p>
        </div>
      </section>

      {/* 새론비즈 소개 */}
      <section className="content-section">
        <h2 className="section-title" style={{ textAlign: 'center', marginBottom: 8 }}>우리가 모인 이유</h2>
        <p className="section-desc" style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 32px' }}>
          학계와 산업계에서 평생을 바친 전문가들이 하나의 질문 앞에 모였습니다.
        </p>

        <div className="about-story-card card" style={{ padding: '40px 32px', marginBottom: 32 }}>
          <blockquote className="about-quote">
            "사람들은 왜 자기 몸에 필요한 영양소조차 제대로 모를까?"
          </blockquote>
          <p style={{ lineHeight: 1.9, fontSize: 15, color: 'var(--text-secondary)', marginTop: 24 }}>
            연구실에서 성분을 분석하던 사람, 공장에서 원료를 만들던 사람,
            강단에서 영양학을 가르치던 사람 — 각자의 자리에서 수십 년을 보낸
            전문가들이 같은 문제의식을 품고 있었습니다.
          </p>
          <p style={{ lineHeight: 1.9, fontSize: 15, color: 'var(--text-secondary)', marginTop: 16 }}>
            건강기능식품 시장은 매년 커지는데, 정작 소비자는 광고와 입소문에
            의존해 영양제를 고릅니다. 내 몸에 진짜 필요한 게 뭔지 알려주는 곳은
            어디에도 없었습니다.
          </p>
          <p style={{ lineHeight: 1.9, fontSize: 15, marginTop: 16 }}>
            <strong>새론비즈</strong>는 그 답을 만들기 위해 모인 팀입니다.
            식품영양학 박사, 임상영양 전문가, 수면과학 연구자가 의기투합하여
            과학적 근거와 실제 데이터에 기반한 맞춤 영양제 추천 시스템을
            설계하고 있습니다.
          </p>
          <p style={{ lineHeight: 1.9, fontSize: 15, color: 'var(--text-secondary)', marginTop: 16 }}>
            우리의 목표는 단순합니다. 누구나 자기 몸에 맞는 영양소를 쉽고
            정확하게 찾을 수 있는 세상. 광고가 아니라 과학이 추천하는 세상.
            그것이 새론비즈가 꿈꾸는 건강한 세상입니다.
          </p>
        </div>

        <div className="about-intro-row">
          <img src="/supp-natural.jpg" alt="자연 유래 영양 성분" className="about-intro-img" />
          <div className="grid-3" style={{ marginBottom: 0, flex: 1 }}>
            {[
              { icon: '🔬', title: '식약처 기준', desc: '국내 식약처가 인정한 28가지 건강기능식품 기능성만을 다룹니다. 검증되지 않은 성분은 추천하지 않습니다.' },
              { icon: '⚕️', title: '안전성 우선', desc: '약물 상호작용, 과잉 섭취 위험, 질환별 금기사항을 자동으로 검증합니다. 30종 영양제 × 13개 질환 교차 분석.' },
              { icon: '📊', title: '데이터 기반', desc: '14개 건강 카테고리, 36개 신체 증상, 15개 페르소나를 교차 분석하여 개인별 최적 조합을 도출합니다.' },
            ].map((item, i) => (
              <div key={i} className="card" style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>내 몸에 맞는 영양제, 지금 찾아보세요</h2>
        <Link to="/survey" className="btn btn-primary" style={{ maxWidth: 320, margin: '16px auto 0' }}>
          ✨ 무료 분석 시작하기
        </Link>
      </section>
    </div>
  )
}
