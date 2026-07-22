import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MEOKSEON_ENABLED, MEAL_ENABLED } from '../lib/flags'

// 라우트 게이트(App)와 일치 — flag off 시 죽은 링크 방지.
// 주간 리포트 → 식사 기록 페이지 내부 링크로 통합 (2026-07-22).
// 회사 소개·운영진·유용한 링크 → Footer 로 통합 (Footer.tsx 에 이미 존재).
const NAV_ITEMS = [
  { path: '/', label: '홈' },
  ...(MEOKSEON_ENABLED ? [{ path: '/scan', label: '가공식품' }] : []),
  ...(MEAL_ENABLED ? [{ path: '/meal', label: '식사 기록' }] : []),
  { path: '/dashboard', label: '내 건강' },
  { path: '/survey', label: '영양제 추천' },
  { path: '/blog', label: '영양정보' },
  { path: '/account', label: '계정' },
]

export default function Navbar() {
  const location = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <img src="/logo-character.png" alt="서박사의 영양공식" className="brand-logo" />
        </Link>

        <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="메뉴">
          {open ? '✕' : '☰'}
        </button>

        <ul className={`nav-links ${open ? 'open' : ''}`}>
          {NAV_ITEMS.map(item => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
