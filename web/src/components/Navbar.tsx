import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MEOKSEON_ENABLED } from '../lib/flags'

// '/scan'은 MEOKSEON_ENABLED일 때만 노출(App의 라우트 게이트와 일치 — flag off 시 죽은 링크 방지).
const NAV_ITEMS = [
  { path: '/', label: '홈' },
  ...(MEOKSEON_ENABLED ? [{ path: '/scan', label: '제품 스캔' }] : []),
  { path: '/dashboard', label: '내 건강' },
  { path: '/survey', label: '영양제 추천' },
  { path: '/blog', label: '영양정보' },
  { path: '/about', label: '회사 소개' },
  { path: '/team', label: '운영진' },
  { path: '/resources', label: '유용한 링크' },
  { path: '/account', label: '계정' },
]

export default function Navbar() {
  const location = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <img src="/logo.png" alt="서박사의 영양공식" className="brand-logo" />
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
