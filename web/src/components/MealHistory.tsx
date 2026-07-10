import { useState, useEffect } from 'react'
import {
  listMeals, deleteMeal, summarizeMeals, slotLabel, titleOf, kcalOf,
  type MealRecord, type MealStat,
} from '../lib/mealHistory'
import { adjustSliderSingle, suggestPhotoAi, confirmPhotoAi } from '../lib/mealLeftover'
import type { MealSummary } from '../lib/nutrilens'

// 내 최근 식사(리텐션). 각 카드에 '먹은 양' 보정:
//   Path A 슬라이더(결정론) + Path B 식후사진 AI(제안→확인 2단계). 표시는 서버 adjusted_summary만.
interface AdjustState {
  ratioPct: number
  adjusted?: MealSummary
  busy?: boolean
  err?: string
  photoMode?: boolean       // suggest 후 확인 대기(미리보기, 미저장)
  suggestedNote?: string
  previewKcal?: number      // 미리보기(비확정)
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

  // Path A: 슬라이더 결정론 반영
  async function applyRatio(r: MealRecord, pct: number) {
    patch(r.id, { ratioPct: pct, busy: true, err: undefined })
    try {
      const res = await adjustSliderSingle(r.id, pct / 100)
      setAdj((s) => ({ ...s, [r.id]: { ratioPct: pct, adjusted: res.adjusted_summary, busy: false } }))
    } catch (e) {
      patch(r.id, { ratioPct: pct, busy: false, err: (e as Error).message })
    }
  }

  // Path B 제안: 식후사진 → AI 추정(미리보기, 미저장)
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
      // AI 실패 → 슬라이더 폴백
      patch(r.id, { busy: false, photoMode: false, err: (e as Error).message })
    }
  }

  // Path B 확인: 사용자가 비율 확정 → 저장(카드 확정 갱신)
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
                  {photoMode && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      🤖 {a?.suggestedNote}
                      {typeof a?.previewKcal === 'number' && <><br />미리보기: 약 {a.previewKcal} kcal (저장 전)</>}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span>먹은 양</span><strong style={{ color: 'var(--text)' }}>{pct}%</strong>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={pct}
                    onChange={(e) => patch(r.id, { ratioPct: Number(e.target.value) })}
                    style={{ width: '100%' }} aria-label="먹은 양 비율" />

                  {photoMode ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-primary" disabled={a?.busy}
                        style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
                        onClick={() => confirmPhoto(r, pct)}>{a?.busy ? '저장 중…' : '이 비율로 저장'}</button>
                      <button type="button" className="btn btn-secondary" disabled={a?.busy}
                        style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                        onClick={() => patch(r.id, { photoMode: false, suggestedNote: undefined, previewKcal: undefined })}>취소</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-primary" disabled={a?.busy}
                        style={{ flex: 1, minWidth: 120, padding: '8px 12px', fontSize: 13 }}
                        onClick={() => applyRatio(r, pct)}>{a?.busy ? '반영 중…' : '이 비율로 반영'}</button>
                      <label className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: 13, cursor: a?.busy ? 'default' : 'pointer' }}>
                        📷 식후 사진
                        <input type="file" accept="image/*" capture="environment" disabled={a?.busy} style={{ display: 'none' }}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPickAfter(r, f) }} />
                      </label>
                      {adjusted && (
                        <button type="button" className="btn btn-secondary" disabled={a?.busy}
                          style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                          onClick={() => applyRatio(r, 100)}>되돌리기</button>
                      )}
                    </div>
                  )}
                  {a?.err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{a.err}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    남긴 양을 반영하면 실제 섭취로 기록돼요. 계산은 서버가 원본 기준으로 처리합니다.
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
