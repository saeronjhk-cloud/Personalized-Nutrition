import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="page fade-in">
      {/* 히어로 */}
      <section className="hero-section" style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #ecfdf5 100%)' }}>
        <h1>바른 먹거리로 건강한 세상을 이룬다</h1>
        <p className="hero-sub">케어앤(Care &amp; N)은 과학적 근거에 기반한 맞춤형 건강기능식품 추천 서비스입니다.</p>
      </section>

      {/* 비전 */}
      <section className="content-section">
        <h2 className="section-title">🏢 새론비즈 소개</h2>
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ lineHeight: 1.8, fontSize: 15 }}>
            새론비즈는 20년 이상의 식품·건강기능식품 산업 경험을 바탕으로
            설립된 헬스케어 테크 기업입니다. 대표 김재환은 (주)네오크레마를
            창업하여 기능성 식품소재 분야의 글로벌 기업으로 성장시킨 경험을
            바탕으로, 이제 소비자가 직접 자신에게 맞는 영양제를 찾을 수 있는
            지능형 추천 시스템을 만들고 있습니다.
          </p>
        </div>

        <div className="grid-3" style={{ marginBottom: 32 }}>
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

        {/* 연혁 */}
        <h2 className="section-title">📅 주요 연혁</h2>
        <div className="card">
          <div className="timeline">
            {[
              { year: '2007', text: '(주)네오크레마 설립 — 기능성 식품소재 개발 시작' },
              { year: '2014', text: '유기농 갈락토올리고당 세계 최초 개발, 특허 등록' },
              { year: '2019', text: '대한민국 기술대상 대통령 표창 수상' },
              { year: '2022', text: '네오크레마 경영 일선 은퇴' },
              { year: '2025', text: '새론비즈 설립, 케어앤(Care & N) 서비스 기획 시작' },
              { year: '2026', text: '케어앤 맞춤 영양제 추천 서비스 베타 런칭' },
            ].map((item, i) => (
              <div key={i} className="timeline-item">
                <span className="timeline-year">{item.year}</span>
                <span className="timeline-text">{item.text}</span>
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
