import { useState, useEffect } from 'react'
import {
  listMeals, deleteMeal, summarizeMeals, slotLabel, titleOf, kcalOf,
  type MealRecord, type MealStat,
} from '../lib/mealHistory'
import { adjustSliderSingle, adjustPerFood, suggestPhotoAi, confirmPhotoAi, foodItemId, splitRatio } from '../lib/mealLeftover'
import type { MealSummary, MealFood } from '../lib/nutrilens'

// 내 최근 식사(리텐션). 각 카드 '먹은 양' 보정:
//   전체 슬라이더(Path A) · 음식별 조절(per_food) · 식후사진 AI(Path B). 표시는 서버 adjusted_summary만.
interface AdjustState {
  ratioPct: number
  adjusted?: MealSummary
  busy?: boolean
  err?: string
  photoMode?: boolean
  suggestedNote?: string
  previewKcal?: number
  perFoodMode?: boolean
  perFoodPct?: number[]      // 음식 인덱스별 %
  people?: number            // 함께 먹은 인원(1/N)
}

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

  function shownKcal(r: MealRecord): number {
    const a = adj[r.id]?.adjusted
    return a ? Math.round(Number(a.total_calories_kcal) || 0) : kcalOf(r)
  }
  function patch(id: string, p: Partial<AdjustState>) {
    setAdj((s) => ({ ...s, [id]: { ...(s[id] || { ratioPct: 100 }), ...p } }))
  }

  // 전체 슬라이더(Path A)
  async function applyRatio(r: MealRecord, pct: number) {
    const people = adj[r.id]?.people ?? 1
    patch(r.id, { ratioPct: pct, busy: true, err: undefined })
    try {
      const res = await adjustSliderSingle(r.id, splitRatio(pct / 100, people))
      setAdj((s) => ({ ...s, [r.id]: { ratioPct: pct, people, adjusted: res.adjusted_summary, busy: false } }))
    } catch (e) {
      patch(r.id, { ratioPct: pct, busy: false, err: (e as Error).message })
    }
  }

  // 음식별 조절(per_food) — 모든 음식 커버
  async function applyPerFood(r: MealRecord) {
    const foods = (r.foods ?? []) as MealFood[]
    const pcts = adj[r.id]?.perFoodPct ?? foods.map(() => 100)
    patch(r.id, { busy: true, err: undefined })
    try {
      const perFood = foods.map((f, i) => ({ food_item_id: foodItemId(f, i), eaten_ratio: (pcts[i] ?? 100) / 100 }))
      const res = await adjustPerFood(r.id, perFood)
      setAdj((s) => ({ ...s, [r.id]: { ratioPct: 100, adjusted: res.adjusted_summary, busy: false, perFoodMode: false } }))
    } catch (e) {
      patch(r.id, { busy: false, err: (e as Error).message })
    }
  }

  // 식후사진 제안(미리보기, 미저장)
  async function onPickAfter(r: MealRecord, file: File) {
    patch(r.id, { busy: true, err: undefined })
    try {
      const sug = await suggestPhotoAi(r.id, file)
      patch(r.id, {
        busy: false, photoMode: true,
        ratioPct: Math.round(sug.estimatedEatenRatio * 100),
        suggestedNote: sug.suggestedNote,
        previewKcal: sug.previewSummary ? Math.round(Number(sug.previewSummary.total_calories_kcal) || 0) : undefined,
      })
    } catch (e) {
      patch(r.id, { busy: false, photoMode: false, err: (e as Error).message })
    }
  }
  // 식후사진 확인(저장, 카드 확정)
  async function confirmPhoto(r: MealRecord, pct: number) {
    patch(r.id, { ratioPct: pct, busy: true, err: undefined })
    try {
      const res = await confirmPhotoAi(r.id, pct / 100)
      setAdj((s) => ({ ...s, [r.id]: { ratioPct: pct, adjusted: res.adjusted_summary, busy: false, photoMode: false } }))
    } catch (e) {
      patch(r.id, { ratioPct: pct, busy: false, err: (e as Error).message })
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
          const photoMode = !!a?.photoMode
          const perFoodMode = !!a?.perFoodMode
          const foods = (r.foods ?? []) as MealFood[]
          const pcts = a?.perFoodPct ?? foods.map(() => 100)
          return (
            <li key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {r.thumbUrl
                  ? <img src={r.thumbUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  : <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--border-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🍽️</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(r)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {slotLabel(r.meal_slot)} · {shownKcal(r)} kcal{adjusted ? ' (보정됨)' : ''} · {new Date(r.eaten_at).toLocaleDateString()}
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
                  {perFoodMode ? (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>음식별로 먹은 양</div>
                      {foods.map((f, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name_ko || `음식 ${i + 1}`}</span>
                            <strong style={{ color: 'var(--text)' }}>{pcts[i] ?? 100}%</strong>
                          </div>
                          <input type="range" min={0} max={100} step={5} value={pcts[i] ?? 100}
                            onChange={(e) => { const np = [...pcts]; np[i] = Number(e.target.value); patch(r.id, { perFoodPct: np }) }}
                            style={{ width: '100%' }} aria-label={`${f.name_ko} 먹은 양`} />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-primary" disabled={a?.busy} style={{ flex: 1, padding: '8px 12px', fontSize: 13 }} onClick={() => applyPerFood(r)}>{a?.busy ? '반영 중…' : '음식별로 반영'}</button>
                        <button type="button" className="btn btn-secondary" disabled={a?.busy} style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }} onClick={() => patch(r.id, { perFoodMode: false })}>취소</button>
                      </div>
                    </>
                  ) : photoMode ? (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        🤖 {a?.suggestedNote}
                        {typeof a?.previewKcal === 'number' && <><br />미리보기: 약 {a.previewKcal} kcal (저장 전)</>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span>먹은 양</span><strong style={{ color: 'var(--text)' }}>{pct}%</strong>
                      </div>
                      <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => patch(r.id, { ratioPct: Number(e.target.value) })} style={{ width: '100%' }} aria-label="먹은 양 비율" />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-primary" disabled={a?.busy} style={{ flex: 1, padding: '8px 12px', fontSize: 13 }} onClick={() => confirmPhoto(r, pct)}>{a?.busy ? '저장 중…' : '이 비율로 저장'}</button>
                        <button type="button" className="btn btn-secondary" disabled={a?.busy} style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }} onClick={() => patch(r.id, { photoMode: false, suggestedNote: undefined, previewKcal: undefined })}>취소</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span>전체 먹은 양</span><strong style={{ color: 'var(--text)' }}>{pct}%</strong>
                      </div>
                      <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => patch(r.id, { ratioPct: Number(e.target.value) })} style={{ width: '100%' }} aria-label="먹은 양 비율" />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0' }}>
                        <span>함께 먹은 인원</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button type="button" className="btn btn-secondary" disabled={a?.busy} style={{ width: 'auto', padding: '4px 12px', fontSize: 15 }} onClick={() => patch(r.id, { people: Math.max(1, (a?.people ?? 1) - 1) })}>−</button>
                          <strong style={{ color: 'var(--text)', minWidth: 34, textAlign: 'center' }}>{a?.people ?? 1}명</strong>
                          <button type="button" className="btn btn-secondary" disabled={a?.busy} style={{ width: 'auto', padding: '4px 12px', fontSize: 15 }} onClick={() => patch(r.id, { people: Math.min(12, (a?.people ?? 1) + 1) })}>+</button>
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-primary" disabled={a?.busy} style={{ flex: 1, minWidth: 110, padding: '8px 12px', fontSize: 13 }} onClick={() => applyRatio(r, pct)}>{a?.busy ? '반영 중…' : '전체 반영'}</button>
                        {foods.length > 1 && (
                          <button type="button" className="btn btn-secondary" disabled={a?.busy} style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                            onClick={() => patch(r.id, { perFoodMode: true, perFoodPct: foods.map(() => 100) })}>음식별 조절</button>
                        )}
                        <label className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: 13, cursor: a?.busy ? 'default' : 'pointer' }}>
                          📷 식후 사진
                          <input type="file" accept="image/*" capture="environment" disabled={a?.busy} style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPickAfter(r, f) }} />
                        </label>
                        {adjusted && (
                          <button type="button" className="btn btn-secondary" disabled={a?.busy} style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }} onClick={() => applyRatio(r, 100)}>되돌리기</button>
                        )}
                      </div>
                    </>
                  )}
                  {a?.err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{a.err}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    남긴 양을 반영하면 실제 섭취로 기록돼요. 여러 명이 나눠 먹었다면 인원을 설정하면 내 몫(먹은 양÷인원)으로 계산됩니다.
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
