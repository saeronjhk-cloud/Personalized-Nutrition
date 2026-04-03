export default function Resources() {
  const sections = [
    {
      title: '정부 기관',
      emoji: '\ud83c\udfe5',
      links: [
        {
          name: '식품의약품안전처',
          url: 'https://www.mfds.go.kr',
          desc: '건강기능식품 기능성 원료 인정, 안전성 정보, 법규 등 공식 기준을 확인할 수 있습니다.',
        },
        {
          name: '식품안전나라',
          url: 'https://www.foodsafetykorea.go.kr',
          desc: '식품 영양성분 데이터베이스, 건강기능식품 정보, 식품 이력 추적 서비스를 제공합니다.',
        },
        {
          name: '국민건강보험공단 건강iN',
          url: 'https://www.nhis.or.kr',
          desc: '건강검진 결과 조회, 만성질환 관리 정보, 건강 상담 서비스를 제공합니다.',
        },
        {
          name: '질병관리청',
          url: 'https://www.kdca.go.kr',
          desc: '국민건강영양조사 결과, 질병 통계, 건강 관련 연구 자료를 공개합니다.',
        },
      ],
    },
    {
      title: '학술 및 전문 기관',
      emoji: '\ud83d\udcda',
      links: [
        {
          name: '한국영양학회',
          url: 'https://www.kns.or.kr',
          desc: '한국인 영양소 섭취기준(KDRIs), 영양 관련 학술 자료, 정책 제안을 발행합니다.',
        },
        {
          name: '대한영양사협회',
          url: 'https://www.dietitian.or.kr',
          desc: '영양 상담, 식단 관리, 영양사 찾기 등 전문 영양 서비스를 안내합니다.',
        },
        {
          name: '한국건강기능식품협회',
          url: 'https://www.hfood.or.kr',
          desc: '건강기능식품 산업 동향, 소비자 교육, 인증 제품 목록을 제공합니다.',
        },
      ],
    },
    {
      title: '유용한 도구',
      emoji: '\ud83d\udee0\ufe0f',
      links: [
        {
          name: '건강기능식품 기능성 원료 정보 (식약처)',
          url: 'https://www.mfds.go.kr/wpge/m_372/de011018l001.do',
          desc: '식약처가 인정한 모든 건강기능식품 기능성 원료의 상세 정보를 조회할 수 있습니다.',
        },
        {
          name: '영양성분 데이터베이스 (식품안전나라)',
          url: 'https://various.foodsafetykorea.go.kr/nutrient/',
          desc: '국내 식품의 영양성분을 검색하고 비교할 수 있는 데이터베이스입니다.',
        },
        {
          name: 'PubMed (미국 국립의학도서관)',
          url: 'https://pubmed.ncbi.nlm.nih.gov',
          desc: '세계 최대 의학·생명과학 논문 데이터베이스. 영양소 효과에 대한 최신 연구를 검색할 수 있습니다.',
        },
      ],
    },
    {
      title: '주의사항 안내',
      emoji: '\u26a0\ufe0f',
      links: [
        {
          name: '의약품 상호작용 확인 (KIMS)',
          url: 'https://www.kims.co.kr',
          desc: '의약품 정보 및 약물 간 상호작용을 확인할 수 있습니다.',
        },
        {
          name: '건강기능식품 부작용 신고센터',
          url: 'https://www.mfds.go.kr',
          desc: '건강기능식품 섭취 후 이상반응이 발생한 경우 식약처에 신고할 수 있습니다.',
        },
      ],
    },
  ]

  return (
    <div className="page fade-in">
      <section className="hero-section" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #dbeafe 100%)' }}>
        <h1>유용한 링크</h1>
        <p className="hero-sub">신뢰할 수 있는 영양·건강 관련 기관과 도구 모음</p>
      </section>

      <section className="content-section">
        {sections.map((sec, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <h2 className="section-title">{sec.emoji} {sec.title}</h2>
            <div className="resource-list">
              {sec.links.map((link, j) => (
                <a
                  key={j}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="resource-card card"
                >
                  <div className="resource-card-header">
                    <h3>{link.name}</h3>
                    <span className="resource-external">\u2197</span>
                  </div>
                  <p>{link.desc}</p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
