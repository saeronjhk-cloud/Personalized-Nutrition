import { Link } from 'react-router-dom'
import { useState } from 'react'

interface BlogEntry {
  slug: string
  title: string
  summary: string
  category: string
  date: string
  emoji: string
  thumb: string
  readMin: number
}

const POSTS: BlogEntry[] = [
  {
    slug: 'vitamin-d-guide',
    title: '비타민 D, 얼마나 먹어야 할까?',
    summary: '한국인의 90% 이상이 비타민 D 부족 상태입니다. 권장량, 흡수를 높이는 방법, 과잉 섭취 주의점까지 정리했습니다.',
    category: '비타민',
    date: '2026-03-28',
    emoji: '\u2600\ufe0f',
    thumb: '/supp-bowls.jpg',
    readMin: 5,
  },
  {
    slug: 'omega3-epa-dha',
    title: '오메가-3, EPA와 DHA 차이점 완전 정리',
    summary: 'EPA는 항염증, DHA는 뇌 건강에 중요합니다. 나에게 맞는 비율과 식약처 인정 기능성을 알아봅니다.',
    category: '오메가-3',
    date: '2026-03-22',
    emoji: '\ud83d\udc1f',
    thumb: '/supp-overhead.jpg',
    readMin: 6,
  },
  {
    slug: 'probiotics-basics',
    title: '유산균, 아무거나 먹으면 안 되는 이유',
    summary: '프로바이오틱스 균주마다 효능이 다릅니다. 장 건강, 면역, 여성 건강 등 목적별 균주 선택법을 안내합니다.',
    category: '유산균',
    date: '2026-03-15',
    emoji: '\ud83e\uddec',
    thumb: '/supp-bottles.jpg',
    readMin: 7,
  },
  {
    slug: 'magnesium-types',
    title: '마그네슘 종류별 효과 — 어떤 걸 골라야 할까?',
    summary: '산화마그네슘, 구연산마그네슘, 글리시네이트 등 형태에 따라 흡수율과 효능이 크게 다릅니다.',
    category: '미네랄',
    date: '2026-03-08',
    emoji: '\ud83d\udca4',
    thumb: '/supp-hero.jpg',
    readMin: 5,
  },
  {
    slug: 'supplement-timing',
    title: '영양제 복용 시간, 이것만 기억하세요',
    summary: '지용성 비타민은 식후에, 철분은 공복에? 복용 타이밍에 따라 흡수율이 달라지는 영양소들을 정리했습니다.',
    category: '복용법',
    date: '2026-03-01',
    emoji: '\u23f0',
    thumb: '/supp-natural.jpg',
    readMin: 4,
  },
  {
    slug: 'iron-deficiency-women',
    title: '여성에게 흔한 철분 부족, 증상과 대처법',
    summary: '피로감, 어지러움, 손톱 변형까지 — 철분 결핍의 신호와 식약처 기준 올바른 보충 방법을 알아봅니다.',
    category: '미네랄',
    date: '2026-02-22',
    emoji: '\ud83e\ude78',
    thumb: '/supp-capsule.jpg',
    readMin: 5,
  },
]

const CATEGORIES = ['전체', ...Array.from(new Set(POSTS.map(p => p.category)))]

export default function Blog() {
  const [cat, setCat] = useState('전체')
  const filtered = cat === '전체' ? POSTS : POSTS.filter(p => p.category === cat)

  return (
    <div className="page fade-in">
      <section className="hero-section hero-with-img">
        <img src="/supp-bowls.jpg" alt="" className="hero-bg-img" aria-hidden="true" />
        <div className="hero-overlay">
          <h1>영양정보 블로그</h1>
          <p className="hero-sub">과학적 근거에 기반한 건강기능식품 정보를 전해드립니다</p>
        </div>
      </section>

      <section className="content-section">
        {/* 카테고리 필터 */}
        <div className="blog-categories">
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`cat-chip ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 글 목록 */}
        <div className="blog-grid">
          {filtered.map(post => (
            <Link key={post.slug} to={`/blog/${post.slug}`} className="blog-card card">
              <div className="blog-card-thumb">
                <img src={post.thumb} alt="" className="blog-card-img" />
              </div>
              <div className="blog-card-body">
              <span className="blog-card-cat">{post.category}</span>
              <h3 className="blog-card-title">{post.title}</h3>
              <p className="blog-card-summary">{post.summary}</p>
              <div className="blog-card-meta">
                <span>{post.date}</span>
                <span>{post.readMin}분 읽기</span>
              </div>
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
            해당 카테고리의 글이 없습니다.
          </p>
        )}
      </section>
    </div>
  )
}
