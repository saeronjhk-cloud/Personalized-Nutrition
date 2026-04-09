import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import PageMeta from '../components/PageMeta'

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

export default function Blog() {
  const [posts, setPosts] = useState<BlogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cat, setCat] = useState('전체')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/blog')
      .then(res => {
        if (!res.ok) throw new Error('블로그 글을 불러올 수 없습니다.')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setPosts(data.posts || [])
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || '오류가 발생했습니다.')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const categories = ['전체', ...Array.from(new Set(posts.map(p => p.category)))]
  const filtered = cat === '전체' ? posts : posts.filter(p => p.category === cat)

  return (
    <div className="page fade-in">
      <PageMeta title="영양정보 블로그" description="비타민, 오메가-3, 유산균, 마그네슘 등 건강기능식품에 대한 과학적 근거 기반 정보를 전해드립니다." />
      <section className="hero-section hero-with-img">
        <img src="/supp-bowls.jpg" alt="" className="hero-bg-img" aria-hidden="true" />
        <div className="hero-overlay">
          <h1>영양정보 블로그</h1>
          <p className="hero-sub">과학적 근거에 기반한 건강기능식품 정보를 전해드립니다</p>
        </div>
      </section>

      <section className="content-section">
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
            <p>블로그 글을 불러오는 중...</p>
          </div>
        )}

        {error && !loading && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '20px 24px',
            textAlign: 'center',
            color: '#991b1b',
          }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ {error}</p>
            <p style={{ fontSize: 13, color: '#7f1d1d' }}>잠시 후 다시 시도해 주세요.</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 카테고리 필터 */}
            <div className="blog-categories">
              {categories.map(c => (
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
                {posts.length === 0 ? '아직 발행된 글이 없습니다.' : '해당 카테고리의 글이 없습니다.'}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
