import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface BlogEntry {
  slug: string
  title: string
  summary: string
  category: string
  date: string
  emoji: string
}

/**
 * 홈페이지 하단에 새 블로그 알림을 띄우는 슬라이드업 배너.
 * - /api/blog에서 최신 글을 가져옴
 * - localStorage에 마지막으로 닫은 글의 slug를 저장
 * - 새 글이 올라오면 자동으로 다시 표시
 * - 3초 뒤 슬라이드업 애니메이션으로 등장
 */
export default function NewBlogPopup() {
  const [post, setPost] = useState<BlogEntry | null>(null)
  const [visible, setVisible] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch('/api/blog')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.posts?.length) return

        // 최신 글 = 첫 번째 (API가 발행일 내림차순 정렬)
        const latest: BlogEntry = data.posts[0]
        const dismissed = localStorage.getItem('blog_popup_dismissed')

        // 이미 이 글을 닫았으면 표시하지 않음
        if (dismissed === latest.slug) return

        setPost(latest)
        setVisible(true)

        // 3초 뒤 슬라이드업 등장
        setTimeout(() => {
          if (!cancelled) setAnimateIn(true)
        }, 3000)
      })
      .catch(() => { /* 조용히 실패 */ })

    return () => { cancelled = true }
  }, [])

  function handleDismiss() {
    setAnimateIn(false)
    // 트랜지션 끝난 뒤 DOM에서 제거
    setTimeout(() => {
      setVisible(false)
      if (post) {
        localStorage.setItem('blog_popup_dismissed', post.slug)
      }
    }, 400)
  }

  if (!visible || !post) return null

  return (
    <div className={`blog-popup ${animateIn ? 'blog-popup--show' : ''}`}>
      <button className="blog-popup__close" onClick={handleDismiss} aria-label="닫기">
        ✕
      </button>
      <div className="blog-popup__badge">📝 새 글</div>
      <div className="blog-popup__emoji">{post.emoji}</div>
      <div className="blog-popup__content">
        <div className="blog-popup__category">{post.category}</div>
        <div className="blog-popup__title">{post.title}</div>
        <div className="blog-popup__summary">{post.summary}</div>
      </div>
      <Link to={`/blog/${post.slug}`} className="blog-popup__link" onClick={handleDismiss}>
        읽으러 가기 →
      </Link>
    </div>
  )
}
