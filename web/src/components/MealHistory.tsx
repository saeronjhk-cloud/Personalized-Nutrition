import { useState, useEffect } from 'react'
import {
  listMeals, deleteMeal, summarizeMeals, slotLabel, titleOf, kcalOf,
  type MealRecord, type MealStat,
} from '../lib/mealHistory'

// 내 최근 식사(리텐션) — Meal 페이지에서 결과를 보고 있지 않을 때 노출.
export default function MealHistory({ reloadKey = 0 }: { reloadKey?: number }) {
  const [items, setItems] = useState<MealRecord[]>([])
  const [stat, setStat] = useState<MealStat | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const list = await listMeals()
    setItems(list)
    setStat(summarizeMeals(list))
    setLoading(false)
  }
  useEffect(() => { load() }, [reloadKey])

  if (loading || !items.length) return null

  return (
    <div className="survey-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 className="survey-step-title" style={{ fontSize: 16 }}>내 최근 식사</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>총 {stat?.total ?? 0}건</span>
      </div>
      {stat && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.6 }}>
          오늘 {stat.todayCount}끼 · 약 {stat.todayKcal} kcal · 최근 7일 {stat.last7Days}끼
        </p>
      )}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.slice(0, 8).map((r) => (
          <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {r.thumbUrl
              ? <img src={r.thumbUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              : <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--border-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🍽️</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(r)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {slotLabel(r.meal_slot)} · {kcalOf(r)} kcal · {new Date(r.eaten_at).toLocaleDateString()}
              </div>
            </div>
            <button type="button" className="btn btn-secondary" aria-label="삭제"
              style={{ width: 'auto', padding: '8px 12px', color: 'var(--text-muted)', flexShrink: 0 }}
              onClick={async () => { if (await deleteMeal(r)) load() }}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
