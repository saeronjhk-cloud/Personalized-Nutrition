import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

interface PostSection {
  heading: string
  body: string
}

interface PostData {
  slug: string
  title: string
  category: string
  date: string
  emoji: string
  thumb: string
  readMin: number
  summary: string
  sections: PostSection[]
  sources: string[]
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setPost(null)

    fetch(`/api/blog/${encodeURIComponent(slug)}`)
      .then(async res => {
        if (res.status === 404) {
          throw new Error('NOT_FOUND')
        }
        if (!res.ok) throw new Error('블로그 글을 불러올 수 없습니다.')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setPost(data.post)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || '오류가 발생했습니다.')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return (
      <div className="page fade-in" style={{ textAlign: 'center', paddingTop: '15vh' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
        <p style={{ color: 'var(--text-muted)' }}>글을 불러오는 중...</p>
      </div>
    )
  }

  if (error === 'NOT_FOUND' || (!post && !loading)) {
    return (
      <div className="page fade-in" style={{ textAlign: 'center', paddingTop: '15vh' }}>
        <h2>글을 찾을 수 없습니다</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
          요청하신 블로그 글이 존재하지 않거나 아직 발행되지 않았습니다.
        </p>
        <Link to="/blog" className="btn btn-secondary" style={{ maxWidth: 240, margin: '0 auto' }}>
          블로그 목록으로 돌아가기
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page fade-in" style={{ textAlign: 'center', paddingTop: '15vh' }}>
        <h2>⚠️ {error}</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
          잠시 후 다시 시도해 주세요.
        </p>
        <Link to="/blog" className="btn btn-secondary" style={{ maxWidth: 240, margin: '0 auto' }}>
          블로그 목록으로 돌아가기
        </Link>
      </div>
    )
  }

  if (!post) return null

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
              {sec.heading && <h2>{sec.heading}</h2>}
              {sec.body.split('\n\n').map((para, j) => (
                <p key={j} style={{ whiteSpace: 'pre-wrap' }}>{para}</p>
              ))}
            </div>
          ))}
        </div>

        {/* 출처 */}
        {post.sources.length > 0 && (
          <div className="blog-sources card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>참고 자료</h3>
            <ul>
              {post.sources.map((s, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{s}</li>
              ))}
            </ul>
          </div>
        )}

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
