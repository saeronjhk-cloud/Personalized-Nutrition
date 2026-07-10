import { useState, useEffect } from 'react'
import {
  listMeals, deleteMeal, summarizeMeals, slotLabel, titleOf, kcalOf,
  type MealRecord, type MealStat,
} from '../lib/mealHistory'
import { adjustSliderSingle } from '../lib/mealLeftover'
import type { MealSummary } from '../lib/nutrilens'

// 내 최근 식사(리텐션) — Meal 페이지에서 결과를 보고 있지 않을 때 노출.
// 각 카드에 '먹은 양' 슬라이더(Path A, 결정론): 서버가 원본×비율 재계산 → adjusted_summary 반영.
interface AdjustState { ratioPct: number; adjusted?: MealSummary; busy?: boolean; err?: string }

export default function MealHistory({ reloadKey = 0 }: { reloadKey?: number }) {
  const [items, setItems] = useState<MealRecord[]>([])
  const [stat, setStat] = useState<MealStat | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adj, setAdj] = useState<Record<string, AdjustState>>({})

  async function load() {
    setLoading(true)
    const list = await listMeals()
    setItems(list)
    setStat(summarizeMeals(list))
    setLoading(false)
  }
  useEffect(() => { load() }, [reloadKey])

  if (loading || !items.length) return null

  // 표시 kcal: 보정 반영됐으면 서버 adjusted, 아니면 원본. (클라 재계산 금지)
  function shownKcal(r: MealRecord): number {
    const a = adj[r.id]?.adjusted
    return a ? Math.round(Number(a.total_calories_kcal) || 0) : kcalOf(r)
  }

  async function applyRatio(r: MealRecord, pct: number) {
    setAdj((s) => ({ ...s, [r.id]: { ...(s[r.id] || { ratioPct: pct }), ratioPct: pct, busy: true, err: undefined } }))
    try {
      const res = await adjustSliderSingle(r.id, pct / 100)
      setAdj((s) => ({ ...s, [r.id]: { ratioPct: pct, adjusted: res.adjusted_summary, busy: false } }))
    } catch (e) {
      setAdj((s) => ({ ...s, [r.id]: { ...(s[r.id] || { ratioPct: pct }), ratioPct: pct, busy: false, err: (e as Error).message } }))
    }
  }

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
        {items.slice(0, 8).map((r) => {
          const a = adj[r.id]
          const isOpen = openId === r.id
          const pct = a?.ratioPct ?? 100
          const adjusted = !!a?.adjusted
          return (
            <li key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {r.thumbUrl
                  ? <img src={r.thumbUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  : <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--border-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🍽️</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(r)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {slotLabel(r.meal_slot)} · {shownKcal(r)} kcal{adjusted ? ` (먹은 양 ${pct}%)` : ''} · {new Date(r.eaten_at).toLocaleDateString()}
                  </div>
                </div>
                <button type="button" className="btn btn-secondary" aria-label="먹은 양 조절"
                  style={{ width: 'auto', padding: '8px 10px', fontSize: 12, flexShrink: 0 }}
                  onClick={() => setOpenId(isOpen ? null : r.id)}>🍚</button>
                <button type="button" className="btn btn-secondary" aria-label="삭제"
                  style={{ width: 'auto', padding: '8px 12px', color: 'var(--text-muted)', flexShrink: 0 }}
                  onClick={async () => { if (await deleteMeal(r)) load() }}>✕</button>
              </div>

              {isOpen && (
                <div style={{ padding: '10px 12px', background: 'var(--border-light)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span>먹은 양</span><strong style={{ color: 'var(--text)' }}>{pct}%</strong>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={pct}
                    onChange={(e) => setAdj((s) => ({ ...s, [r.id]: { ...(s[r.id] || {}), ratioPct: Number(e.target.value) } }))}
                    style={{ width: '100%' }} aria-label="먹은 양 비율" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-primary" disabled={a?.busy}
                      style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
                      onClick={() => applyRatio(r, pct)}>{a?.busy ? '반영 중…' : '이 비율로 반영'}</button>
                    {adjusted && (
                      <button type="button" className="btn btn-secondary" disabled={a?.busy}
                        style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                        onClick={() => applyRatio(r, 100)}>되돌리기</button>
                    )}
                  </div>
                  {a?.err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{a.err}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    남긴 양을 반영하면 실제 섭취 칼로리·영양으로 기록돼요. 계산은 서버가 원본 기준으로 처리합니다.
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
