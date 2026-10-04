/**
 * 홈 개편 v1 — 로그인 재방문 홈: 인사 · 오늘 끼니 기록 · 오늘의 한 가지(승인된 코칭 카드 재사용) · 바로가기
 * 판정: domain/home/home_mode.ts (todaySlots·todayCard·greeting) · 평가 IP/integration/home_redesign_v1_design.md §2-3·H07~H09·H14
 */
import { Link } from 'react-router-dom'
import { MEAL_ENABLED, MEAL_GRAMMAR_ENABLED, GOAL_COACHING_ENABLED, CHECKUP_ENABLED } from '../../lib/flags'
import { todaySlots, todayCards, greeting } from '../../domain/home/home_mode'
import CoachCards from '../CoachCards'

const SLOT_NAMES = ['아침', '점심', '저녁'] as const

function fmtToday(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function ReturningHome({ todayRows }: { todayRows: { eaten_at: string; meal_slot: string | null }[] }) {
  const now = new Date()
  const slots = todaySlots(todayRows, now)
  const cards = todayCards({ meal: MEAL_ENABLED, mealGrammar: MEAL_GRAMMAR_ENABLED, goalCoaching: GOAL_COACHING_ENABLED })
  const links = [
    ...(MEAL_ENABLED ? [{ to: '/meal', label: '🍽️ 식사 기록' }, { to: '/weekly-report', label: '📅 주간 리포트' }] : []),
    { to: '/health-report', label: '📈 건강 변화 리포트' },
    ...(CHECKUP_ENABLED ? [{ to: '/dashboard', label: '🩺 내 건강' }] : []),
    { to: '/recommend?entry=home', label: '💊 맞춤 영양제' },
  ]
  return (
    <section className="returning-home">
      <div className="returning-home__hello">
        <h1>{greeting(now)}</h1>
        <span className="returning-home__date">오늘 {fmtToday(now)}</span>
      </div>

      {MEAL_ENABLED && (
        <div className="returning-home__today">
          <div className="returning-home__slots" aria-label="오늘 끼니 기록">
            {SLOT_NAMES.map((n, i) => (
              <span key={n} className={`returning-home__slot${slots[i] ? ' is-done' : ''}`}>
                {slots[i] ? '●' : '○'} {n}
              </span>
            ))}
          </div>
          <Link to="/meal" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            다음 끼니 기록하기 →
          </Link>
        </div>
      )}

      {cards.length > 0 && (
        <div className="returning-home__one" aria-label="오늘의 한 가지">
          <CoachCards />
        </div>
      )}

      <div className="returning-home__links">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="returning-home__link">{l.label}</Link>
        ))}
      </div>
    </section>
  )
}
