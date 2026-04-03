import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="page fade-in">
      {/* 히어로 */}
      <section className="hero-section hero-home">
        <div style={{ fontSize: 56, marginBottom: 12 }}>💊</div>
        <h1>내 몸에 맞는 영양제 찾기</h1>
        <p className="hero-sub">
          신체 증상과 라이프스타일 분석으로<br />맞춤 건강기능식품을 추천해 드려요
        </p>
        <Link to="/survey" className="btn btn-primary" style={{ maxWidth: 360, margin: '24px auto 0' }}>
          ✨ 무료 분석 시작하기 (약 3분)
        </Link>
      </section>

      {/* 특징 카드 */}
      <section className="content-section">
        <div className="grid-2" style={{ maxWidth: 520, margin: '0 auto', gap: 16 }}>
          {[
            { icon: '🔬', title: '임상 근거 기반', desc: '식약처 인정 28가지 기능성 성분만 추천' },
            { icon: '🩺', title: '결핍 증상 분석', desc: '36가지 신체 신호를 교차 분석' },
            { icon: '⚠️', title: '안전성 검증', desc: '약물 상호작용·질환별 금기 자동 확인' },
            { icon: '🛒', title: '쿠팡 바로 연결', desc: '추천 제품 최저가 검색' },
          ].map((item, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{item.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 간단 소개 */}
      <section className="content-section" style={{ textAlign: 'center' }}>
        <h2 className="section-title">케어앤은 이렇게 다릅니다</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.8, maxWidth: 520, margin: '12px auto 0' }}>
          14개 건강 카테고리, 36개 신체 증상, 15개 페르소나를 교차 분석하여
          개인별 최적 영양제 조합을 도출합니다. 30종 영양제와 13개 질환의
          교차 분석으로 안전성까지 검증합니다.
        </p>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>지금 바로 시작해 보세요</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
          의학적 진단을 대체하지 않습니다. 질환이 있으신 분은 전문의와 상담하세요.
        </p>
        <Link to="/survey" className="btn btn-primary" style={{ maxWidth: 320, margin: '0 auto' }}>
          ✨ 무료 분석 시작하기
        </Link>
      </section>
    </div>
  )
}
