import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/', label: '홈' },
  { path: '/survey', label: '영양제 추천' },
  { path: '/blog', label: '영양정보' },
  { path: '/about', label: '회사 소개' },
  { path: '/team', label: '운영진' },
  { path: '/resources', label: '유용한 링크' },
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
