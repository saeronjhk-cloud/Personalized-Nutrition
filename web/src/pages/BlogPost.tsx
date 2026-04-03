import { useParams, Link } from 'react-router-dom'

/* ── 블로그 콘텐츠 데이터 ── */
interface PostData {
  title: string
  category: string
  date: string
  emoji: string
  readMin: number
  sections: { heading: string; body: string }[]
  sources: string[]
}

const CONTENT: Record<string, PostData> = {
  'vitamin-d-guide': {
    title: '비타민 D, 얼마나 먹어야 할까?',
    category: '비타민',
    date: '2026-03-28',
    emoji: '\u2600\ufe0f',
    readMin: 5,
    sections: [
      {
        heading: '한국인의 비타민 D 현황',
        body: '국민건강영양조사에 따르면 한국인의 약 90% 이상이 비타민 D 부족(혈중 20ng/mL 미만) 상태입니다. 실내 생활이 많고, 자외선 차단제 사용이 보편화되면서 햇빛을 통한 자연 합성이 줄어든 것이 주요 원인입니다.',
      },
      {
        heading: '하루 권장 섭취량',
        body: '한국영양학회 기준 성인 권장량은 400IU(10\u00b5g)이며, 상한 섭취량은 4,000IU입니다. 다만 혈중 농도가 매우 낮은 경우(10ng/mL 미만) 의사의 판단 하에 단기간 고용량 처방이 이루어지기도 합니다. 식약처 건강기능식품 일일 섭취량 기준은 400IU입니다.',
      },
      {
        heading: '흡수를 높이는 방법',
        body: '비타민 D는 지용성이므로 식사와 함께 복용하면 흡수율이 높아집니다. 특히 지방이 포함된 식사(견과류, 올리브오일, 아보카도 등)와 함께 먹으면 효과적입니다. 비타민 K2와 함께 복용하면 칼슘 대사에 시너지 효과가 있다는 연구도 있습니다.',
      },
      {
        heading: '과잉 섭취 주의',
        body: '장기간 10,000IU 이상의 고용량 복용은 고칼슘혈증, 신장 결석 등의 위험이 있습니다. 반드시 혈액검사를 통해 자신의 현재 수치를 확인한 후 적정량을 섭취하세요.',
      },
    ],
    sources: [
      '식품의약품안전처 — 건강기능식품 기능성 원료 인정 현황',
      '한국영양학회 — 2020 한국인 영양소 섭취기준',
      '국민건강영양조사 제8기 (2019-2021)',
    ],
  },
  'omega3-epa-dha': {
    title: '오메가-3, EPA와 DHA 차이점 완전 정리',
    category: '오메가-3',
    date: '2026-03-22',
    emoji: '\ud83d\udc1f',
    readMin: 6,
    sections: [
      {
        heading: 'EPA와 DHA란?',
        body: 'EPA(에이코사펜타엔산)와 DHA(도코사헥사엔산)는 모두 오메가-3 지방산이지만 체내에서 서로 다른 역할을 합니다. EPA는 주로 항염증 작용을 하며, DHA는 뇌와 망막의 주요 구성 성분으로 인지 기능과 시력 건강에 기여합니다.',
      },
      {
        heading: '식약처 인정 기능성',
        body: '식약처는 오메가-3 지방산(EPA 및 DHA 합계 기준 500~2,000mg)에 대해 "혈중 중성지질 개선, 혈행 개선에 도움을 줄 수 있음"이라는 기능성을 인정하고 있습니다.',
      },
      {
        heading: '나에게 맞는 비율 선택하기',
        body: '혈중 중성지방이 걱정이라면 EPA 함량이 높은 제품을, 집중력과 기억력이 걱정이라면 DHA 함량이 높은 제품을 선택하는 것이 일반적입니다. 임산부는 태아 뇌 발달을 위해 DHA 비율이 높은 제품이 권장됩니다.',
      },
      {
        heading: '복용 시 주의사항',
        body: '항응고제(와파린 등)를 복용 중이라면 반드시 의사와 상담 후 섭취하세요. 오메가-3는 혈액 응고를 지연시킬 수 있으므로, 수술 2주 전에는 복용을 중단하는 것이 일반적인 권고입니다.',
      },
    ],
    sources: [
      '식품의약품안전처 — 건강기능식품 기능성 평가 가이드',
      'EFSA Journal — Scientific opinion on EPA/DHA intake',
    ],
  },
  'probiotics-basics': {
    title: '유산균, 아무거나 먹으면 안 되는 이유',
    category: '유산균',
    date: '2026-03-15',
    emoji: '\ud83e\uddec',
    readMin: 7,
    sections: [
      {
        heading: '프로바이오틱스란?',
        body: '프로바이오틱스는 적정량을 섭취했을 때 건강에 유익한 효과를 주는 살아있는 미생물입니다. 흔히 "유산균"이라 부르지만, 모든 프로바이오틱스가 유산균은 아닙니다. 비피더스균, 사카로마이세스 등도 프로바이오틱스에 포함됩니다.',
      },
      {
        heading: '균주마다 효능이 다릅니다',
        body: '같은 락토바실러스 속이라도 균주에 따라 효능이 전혀 다릅니다. 예를 들어 Lactobacillus rhamnosus GG는 장 건강과 면역에, Lactobacillus reuteri RC-14는 여성 질 건강에 도움을 줍니다. 제품을 고를 때는 균종(species)뿐 아니라 균주(strain)까지 확인하세요.',
      },
      {
        heading: '식약처 인정 기능성',
        body: '식약처는 프로바이오틱스에 대해 "유익한 유산균 증식 및 유해균 억제, 배변 활동 원활에 도움을 줄 수 있음"이라는 기능성을 인정하고 있습니다. 일일 섭취량은 1억~100억 CFU입니다.',
      },
      {
        heading: '보관과 복용 팁',
        body: '대부분의 프로바이오틱스는 열과 습기에 약하므로 냉장 보관이 권장됩니다. 항생제를 복용 중이라면 최소 2시간 간격을 두고 섭취하세요. 공복 또는 식전에 복용하면 위산의 영향을 덜 받습니다.',
      },
    ],
    sources: [
      '식품의약품안전처 — 프로바이오틱스 기능성 원료 목록',
      'World Gastroenterology Organisation — Probiotics and Prebiotics Guidelines',
    ],
  },
  'magnesium-types': {
    title: '마그네슘 종류별 효과 — 어떤 걸 골라야 할까?',
    category: '미네랄',
    date: '2026-03-08',
    emoji: '\ud83d\udca4',
    readMin: 5,
    sections: [
      {
        heading: '마그네슘이 중요한 이유',
        body: '마그네슘은 체내 300가지 이상의 효소 반응에 관여하는 필수 미네랄입니다. 근육 이완, 신경 전달, 에너지 생성, 수면 조절 등 광범위한 역할을 합니다. 한국인의 마그네슘 섭취량은 권장량 대비 부족한 경우가 많습니다.',
      },
      {
        heading: '형태별 특징 비교',
        body: '산화마그네슘(MgO)은 마그네슘 함량이 높지만 흡수율이 낮고 변비 완화에 주로 사용됩니다. 구연산마그네슘(Mg Citrate)은 흡수율이 비교적 높고 일반적인 보충에 적합합니다. 글리시네이트(Mg Glycinate)는 흡수율이 가장 높고 수면과 이완에 도움을 줍니다. 트레온산(Mg Threonate)은 뇌 건강과 인지 기능에 초점을 맞춘 형태입니다.',
      },
      {
        heading: '식약처 기준',
        body: '식약처는 마그네슘의 일일 섭취량을 220~350mg으로 설정하고 있으며, "에너지 이용에 필요, 정상적인 세포 분열에 필요"라는 기능성을 인정합니다.',
      },
    ],
    sources: [
      '식품의약품안전처 — 영양소 기능성 고시',
      '한국영양학회 — 한국인 영양소 섭취기준',
    ],
  },
  'supplement-timing': {
    title: '영양제 복용 시간, 이것만 기억하세요',
    category: '복용법',
    date: '2026-03-01',
    emoji: '\u23f0',
    readMin: 4,
    sections: [
      {
        heading: '식후에 먹어야 하는 영양제',
        body: '지용성 비타민(A, D, E, K)과 오메가-3는 지방과 함께 먹어야 흡수율이 높아집니다. 식사 직후, 특히 지방이 포함된 식사 후에 복용하세요. 코엔자임Q10, 루테인도 지용성이므로 같은 원칙이 적용됩니다.',
      },
      {
        heading: '공복에 먹어야 하는 영양제',
        body: '철분제는 공복에 복용했을 때 흡수율이 가장 높습니다. 다만 속이 불편하다면 소량의 음식과 함께 먹어도 됩니다. 비타민 C와 함께 복용하면 철분 흡수가 촉진됩니다.',
      },
      {
        heading: '복용 시간이 중요한 영양제',
        body: '마그네슘과 비타민 B군은 수면에 영향을 줄 수 있습니다. 마그네슘은 저녁 식후 또는 취침 전에, 비타민 B군은 에너지를 높여줄 수 있으므로 아침에 복용하는 것이 좋습니다. 칼슘과 철분은 흡수 경쟁이 있으므로 최소 2시간 간격을 두세요.',
      },
    ],
    sources: [
      '한국영양학회 — 영양소별 복용 가이드',
      '식품의약품안전처 — 건강기능식품 올바른 섭취 안내',
    ],
  },
  'iron-deficiency-women': {
    title: '여성에게 흔한 철분 부족, 증상과 대처법',
    category: '미네랄',
    date: '2026-02-22',
    emoji: '\ud83e\ude78',
    readMin: 5,
    sections: [
      {
        heading: '왜 여성에게 흔한가?',
        body: '가임기 여성은 월경으로 인해 매달 철분을 손실합니다. 한국 가임기 여성의 철분 결핍 유병률은 약 20~30%로, 남성(5% 미만)에 비해 훨씬 높습니다. 임산부와 수유부는 더 많은 철분이 필요합니다.',
      },
      {
        heading: '결핍 증상 알아보기',
        body: '만성 피로, 어지러움, 두통, 숨이 차는 느낌, 손발이 차가움, 얼굴이 창백함, 손톱이 얇아지거나 숟가락 모양으로 변형, 얼음을 씹고 싶은 이식증(pica) 등이 대표적인 증상입니다.',
      },
      {
        heading: '올바른 보충 방법',
        body: '식약처 기준 철분 보충제의 일일 섭취량은 12mg이며, 상한 섭취량은 45mg입니다. 헴철(동물성)이 비헴철(식물성)보다 흡수율이 높습니다. 비타민 C를 함께 복용하면 비헴철의 흡수가 촉진됩니다. 차, 커피, 칼슘제와는 시간 간격을 두고 복용하세요.',
      },
    ],
    sources: [
      '식품의약품안전처 — 영양소 기능성 고시',
      '국민건강영양조사 — 한국인 철분 섭취 현황',
      '대한산부인과학회 — 임산부 철분 보충 가이드라인',
    ],
  },
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? CONTENT[slug] : undefined

  if (!post) {
    return (
      <div className="page fade-in" style={{ textAlign: 'center', paddingTop: '15vh' }}>
        <h2>글을 찾을 수 없습니다</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
          요청하신 블로그 글이 존재하지 않습니다.
        </p>
        <Link to="/blog" className="btn btn-secondary" style={{ maxWidth: 240, margin: '0 auto' }}>
          블로그 목록으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="page fade-in">
      <section className="content-section" style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* 상단 */}
        <Link to="/blog" className="blog-back">&larr; 블로그 목록</Link>

        <div style={{ marginTop: 16 }}>
          <span className="blog-card-cat">{post.category}</span>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>{post.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
            {post.date} &middot; {post.readMin}분 읽기
          </p>
        </div>

        {/* 본문 */}
        <div className="blog-body">
          {post.sections.map((sec, i) => (
            <div key={i} className="blog-section">
              <h2>{sec.heading}</h2>
              <p>{sec.body}</p>
            </div>
          ))}
        </div>

        {/* 출처 */}
        <div className="blog-sources card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>참고 자료</h3>
          <ul>
            {post.sources.map((s, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{s}</li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="cta-section" style={{ marginTop: 32 }}>
          <p style={{ fontSize: 15, marginBottom: 12 }}>나에게 필요한 영양제가 궁금하다면?</p>
          <Link to="/survey" className="btn btn-primary" style={{ maxWidth: 320, margin: '0 auto' }}>
            무료 맞춤 분석 시작하기
          </Link>
        </div>
      </section>
    </div>
  )
}
