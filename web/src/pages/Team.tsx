export default function Team() {
  const members = [
    {
      role: '대표',
      name: '김재환',
      emoji: '👨‍💼',
      title: '새론비즈 대표 / 케어앤 총괄',
      bio: [
        '고려대학교 식품공학 학사 · 식품가공 석사 · 식품영양학 박사',
        '(주)네오크레마 창업자 (2007~2022)',
        '기능성 식품소재 전문 — 유기농 갈락토올리고당 세계 최초 개발',
        '특허 14건 출원·등록',
        '2019 대한민국 기술대상 대통령 표창 수상',
        '대한민국 엔지니어상 수상',
      ],
      quote: '20년 넘게 식품소재를 만들면서 느낀 건, 좋은 성분을 만드는 것만큼 그걸 필요한 사람에게 정확히 연결하는 게 중요하다는 겁니다.',
    },
    {
      role: '자문위원',
      name: '서형주',
      emoji: '👨‍🔬',
      title: '고려대학교 보건과학대학 교수 (전)',
      bio: [
        '고려대학교 식품공학 학사 · 식품가공학/미생물학 석사 · 박사',
        '일본 이화학연구소(RIKEN) 화학공학연구실 촉탁연구원',
        '고려대학교 생물공학연구소 연구원',
        '고려대학교 보건과학대학 바이오시스템의과학부 교수',
        '기능성식품연구실 운영 — 수면, 기능성식품 분야 다수 SCI 논문',
      ],
      quote: '건강기능식품은 반드시 과학적 근거 위에 서야 합니다. 케어앤은 그 원칙을 지키는 서비스입니다.',
    },
    {
      role: '자문위원',
      name: '장은재',
      emoji: '👩‍🔬',
      title: '동덕여자대학교 식품영양학과 교수 (전)',
      bio: [
        '고려대학교 식품공학 학사 · 석사',
        '미국 University of Rhode Island 영양학 박사',
        '두산기술원 연구원',
        '동덕여자대학교 식품영양학과 교수',
        '동덕여대 비만연구센터 소장',
        '동덕여대 산학협력단 단장',
        '대한지역사회영양학회 학술상 수상',
      ],
      quote: '영양학은 개인차가 큽니다. 같은 증상이라도 나이, 성별, 생활습관에 따라 필요한 영양소가 다릅니다. 그래서 맞춤 추천이 중요합니다.',
    },
  ]

  return (
    <div className="page fade-in">
      <section className="hero-section" style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)' }}>
        <h1>운영진 소개</h1>
        <p className="hero-sub">식품·영양 분야 전문가들이 함께 만듭니다</p>
      </section>

      <section className="content-section">
        {members.map((m, i) => (
          <div key={i} className="card team-card" style={{ marginBottom: 24 }}>
            <div className="team-header">
              <div className="team-avatar">{m.emoji}</div>
              <div>
                <span className="team-role-badge">{m.role}</span>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{m.name}</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{m.title}</p>
              </div>
            </div>

            <ul className="team-bio">
              {m.bio.map((line, j) => (
                <li key={j}>{line}</li>
              ))}
            </ul>

            {m.quote && (
              <blockquote className="team-quote">
                "{m.quote}"
              </blockquote>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
