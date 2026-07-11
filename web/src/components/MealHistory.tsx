import { useState, useEffect } from 'react'
import {
  listMeals, deleteMeal, summarizeMeals, slotLabel, titleOf, kcalOf,
  type MealRecord, type MealStat,
} from '../lib/mealHistory'
import { adjustSliderSingle, adjustPerFood, suggestPhotoAi, suggestPhotoAiHybrid, confirmPhotoAi, foodItemId, splitRatio } from '../lib/mealLeftover'
import { MEAL_CMIN_ENABLED } from '../lib/flags'
import type { MealSummary, MealFood } from '../lib/nutrilens'

// 내 최근 식사(리텐션). 각 카드 '먹은 양' 보정 — 설계 LOCK v2(IP 90):
//   카드엔 '먹은 양' 진입점 1개(상태 겸용) → 패널 최상단 세그먼트 [전체 · 음식별 · 사진 추정].
//   전체(Path A) · 음식별(per_food) · 사진 추정(Path B). 표시는 서버 adjusted_summary만(원칙5).
type Mode = 'all' | 'perfood' | 'photo'
interface AdjustState {
  ratioPct: number
  adjusted?: MealSummary
  busy?: boolean
  err?: string
  mode?: Mode                // 패널 세그먼트 선택(기본 all, stateless)
  photoPreview?: boolean      // 사진 추정 미리보기 로드됨
  suggestedNote?: string
  previewKcal?: number
  perFoodPct?: number[]       // 음식 인덱스별 %
  people?: number             // 함께 먹은 인원(1/N)
  adjKind?: 'ratio' | 'perfood'  // 카드 진입칩 상태표기용
  adjPct?: number             // ratio 보정 시 %
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'perfood', label: '음식별' },
  { key: 'photo', label: '사진 추정' },
]

// 진입칩 라벨 — 목적("먹은 양")은 항상 유지, 보정 시 상태 표기.
function entryLabel(a?: AdjustState): string {
  if (!a?.adjusted) return '먹은 양'
  if (a.adjKind === 'perfood') return '먹은 양 · 수정됨'
  if (a.adjKind === 'ratio' && typeof a.adjPct === 'number' && a.adjPct < 100) return `먹은 양 · ${a.adjPct}%`
  return '먹은 양'
}

function AdjustIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line x1="4" y1="8" x2="20" y2="8" /><circle cx="9" cy="8" r="2.6" fill="var(--bg-card)" />
      <line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.6" fill="var(--bg-card)" />
    </svg>
  )
}
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
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
  // 카드 열기/닫기 — 열 때 항상 초기 뷰(세그먼트 '전체', 미리보기 리셋). Stateless.
  function toggleCard(r: MealRecord) {
    if (openId === r.id) { setOpenId(null); return }
    setOpenId(r.id)
    patch(r.id, { mode: 'all', photoPreview: false, suggestedNote: undefined, previewKcal: undefined, err: undefined })
  }

  // 전체 슬라이더(Path A)
  async function applyRatio(r: MealRecord, pct: number) {
    const people = adj[r.id]?.people ?? 1
    patch(r.id, { ratioPct: pct, busy: true, err: undefined })
    try {
      const res = await adjustSliderSingle(r.id, splitRatio(pct / 100, people))
      setAdj((s) => ({ ...s, [r.id]: { ...(s[r.id] || { ratioPct: 100 }), ratioPct: pct, people, adjusted: res.adjusted_summary, busy: false, mode: 'all', adjKind: 'ratio', adjPct: pct, err: undefined } }))
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
      setAdj((s) => ({ ...s, [r.id]: { ...(s[r.id] || { ratioPct: 100 }), ratioPct: 100, adjusted: res.adjusted_summary, busy: false, mode: 'all', adjKind: 'perfood', err: undefined } }))
    } catch (e) {
      patch(r.id, { busy: false, err: (e as Error).message })
    }
  }

  // 식후사진 제안(미리보기, 미저장)
  async function onPickAfter(r: MealRecord, file: File) {
    patch(r.id, { busy: true, err: undefined, mode: 'photo' })
    try {
      const sug = await (MEAL_CMIN_ENABLED ? suggestPhotoAiHybrid : suggestPhotoAi)(r.id, file)
      patch(r.id, {
        busy: false, mode: 'photo', photoPreview: true,
        ratioPct: Math.round(sug.estimatedEatenRatio * 100),
        suggestedNote: sug.suggestedNote,
        previewKcal: sug.previewSummary ? Math.round(Number(sug.previewSummary.total_calories_kcal) || 0) : undefined,
      })
    } catch (e) {
      patch(r.id, { busy: false, photoPreview: false, err: (e as Error).message })
    }
  }
  // 식후사진 확인(저장, 카드 확정)
  async function confirmPhoto(r: MealRecord, pct: number) {
    patch(r.id, { ratioPct: pct, busy: true, err: undefined })
    try {
      const res = await confirmPhotoAi(r.id, pct / 100)
      setAdj((s) => ({ ...s, [r.id]: { ...(s[r.id] || { ratioPct: 100 }), ratioPct: pct, adjusted: res.adjusted_summary, busy: false, mode: 'all', photoPreview: false, suggestedNote: undefined, previewKcal: undefined, adjKind: 'ratio', adjPct: pct, err: undefined } }))
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
          const mode: Mode = a?.mode ?? 'all'
          const foods = (r.foods ?? []) as MealFood[]
          const pcts = a?.perFoodPct ?? foods.map(() => 100)
          const perFoodAvail = foods.length >= 1
          const hasAdjustment = adjusted && !(a?.adjKind === 'ratio' && a?.adjPct === 100)
          const panelId = `meal-panel-${r.id}`
          return (
            <li key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* 요약 행: 썸네일 · 음식명/kcal · 삭제 */}
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
                <button type="button" className="btn btn-secondary" aria-label="삭제"
                  style={{ width: 'auto', minHeight: 40, padding: '8px 12px', color: 'var(--text-muted)', flexShrink: 0 }}
                  onClick={async () => { if (await deleteMeal(r)) load() }}>✕</button>
              </div>

              {/* 액션 행: '먹은 양' 진입점(상시·상태 겸용, 우측 정렬) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" aria-label="먹은 양 조절" aria-expanded={isOpen} aria-controls={panelId}
                  onClick={() => toggleCard(r)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 48, padding: '0 12px',
                    background: 'var(--border-light)', color: hasAdjustment ? 'var(--text)' : 'var(--text-secondary)',
                    border: 'none', borderRadius: 'var(--radius-sm, 8px)', fontSize: 13,
                    fontWeight: hasAdjustment ? 600 : 500, cursor: 'pointer',
                  }}>
                  <AdjustIcon />
                  {entryLabel(a)}
                  <Chevron open={isOpen} />
                </button>
              </div>

              {isOpen && (
                <div id={panelId} role="region" aria-label="먹은 양 조절"
                  style={{ padding: '10px 12px', background: 'var(--border-light)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>먹은 양 조절</div>

                  {/* 세그먼트 컨트롤 — 3모드 동등 위계, 항상 최상단 */}
                  <div role="tablist" aria-label="먹은 양 조절 방식"
                    style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--border)', borderRadius: 'var(--radius-sm, 8px)' }}>
                    {MODES.map((m) => {
                      const selected = mode === m.key
                      const disabled = m.key === 'perfood' && !perFoodAvail
                      return (
                        <button key={m.key} type="button" role="tab" aria-selected={selected} disabled={disabled || a?.busy}
                          onClick={() => patch(r.id, { mode: m.key, err: undefined })}
                          style={{
                            flex: 1, minHeight: 44, padding: '9px 6px', fontSize: 13,
                            border: 'none', borderRadius: 'var(--radius-sm, 6px)', cursor: disabled ? 'not-allowed' : 'pointer',
                            background: selected ? 'var(--bg-card)' : 'transparent',
                            color: disabled ? 'var(--text-muted)' : selected ? 'var(--text)' : 'var(--text-secondary)',
                            fontWeight: selected ? 700 : 500,
                            boxShadow: selected ? 'var(--shadow-sm)' : 'none',
                          }}>{m.label}</button>
                      )
                    })}
                  </div>

                  {/* 전체 모드 */}
                  {mode === 'all' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span>전체 먹은 양</span><strong style={{ color: 'var(--text)' }}>{pct}%</strong>
                      </div>
                      <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => patch(r.id, { ratioPct: Number(e.target.value) })} style={{ width: '100%' }} aria-label="전체 먹은 양 비율" />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0' }}>
                        <span>함께 먹은 인원</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button type="button" className="btn btn-secondary" aria-label="인원 줄이기" disabled={a?.busy} style={{ width: 'auto', minHeight: 40, padding: '4px 14px', fontSize: 15 }} onClick={() => patch(r.id, { people: Math.max(1, (a?.people ?? 1) - 1) })}>−</button>
                          <strong style={{ color: 'var(--text)', minWidth: 34, textAlign: 'center' }}>{a?.people ?? 1}명</strong>
                          <button type="button" className="btn btn-secondary" aria-label="인원 늘리기" disabled={a?.busy} style={{ width: 'auto', minHeight: 40, padding: '4px 14px', fontSize: 15 }} onClick={() => patch(r.id, { people: Math.min(12, (a?.people ?? 1) + 1) })}>+</button>
                        </span>
                      </div>
                      <button type="button" className="btn btn-primary" disabled={a?.busy} style={{ width: '100%', minHeight: 44, padding: '8px 12px', fontSize: 13 }} onClick={() => applyRatio(r, pct)}>{a?.busy ? '반영 중…' : '전체 반영'}</button>
                    </>
                  )}

                  {/* 음식별 모드 */}
                  {mode === 'perfood' && (
                    perFoodAvail ? (
                      <>
                        {foods.map((f, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name_ko || `음식 ${i + 1}`}</span>
                              <strong style={{ color: 'var(--text)' }}>{pcts[i] ?? 100}%</strong>
                            </div>
                            <input type="range" min={0} max={100} step={5} value={pcts[i] ?? 100}
                              onChange={(e) => { const np = [...pcts]; np[i] = Number(e.target.value); patch(r.id, { perFoodPct: np }) }}
                              style={{ width: '100%' }} aria-label={`${f.name_ko || `음식 ${i + 1}`} 먹은 양`} />
                          </div>
                        ))}
                        <button type="button" className="btn btn-primary" disabled={a?.busy} style={{ width: '100%', minHeight: 44, padding: '8px 12px', fontSize: 13 }} onClick={() => applyPerFood(r)}>{a?.busy ? '반영 중…' : '음식별로 반영'}</button>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>음식 항목이 없어 음식별 조절을 쓸 수 없어요. '전체'에서 조절해 주세요.</div>
                    )
                  )}

                  {/* 사진 추정 모드 */}
                  {mode === 'photo' && (
                    a?.photoPreview ? (
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
                          <button type="button" className="btn btn-primary" disabled={a?.busy} style={{ flex: 1, minHeight: 44, padding: '8px 12px', fontSize: 13 }} onClick={() => confirmPhoto(r, pct)}>{a?.busy ? '저장 중…' : '추정값 적용'}</button>
                          <button type="button" className="btn btn-secondary" disabled={a?.busy} style={{ width: 'auto', minHeight: 44, padding: '8px 12px', fontSize: 13 }} onClick={() => patch(r.id, { photoPreview: false, suggestedNote: undefined, previewKcal: undefined })}>다시 찍기</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>식후 남은 음식을 촬영하면 AI가 먹은 양을 추정해요. 확인 후에만 저장됩니다.</div>
                        <label className="btn btn-primary" style={{ width: '100%', minHeight: 44, padding: '8px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: a?.busy ? 'default' : 'pointer' }}>
                          {a?.busy ? '분석 중…' : '식후 사진 찍기'}
                          <input type="file" accept="image/*" capture="environment" disabled={a?.busy} style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPickAfter(r, f) }} />
                        </label>
                      </>
                    )
                  )}

                  {a?.err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{a.err}</div>}

                  {/* 되돌리기 — 보정 이력 있을 때만, 낮은 위계 */}
                  {hasAdjustment && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: 8 }}>
                      <button type="button" disabled={a?.busy}
                        onClick={() => applyRatio(r, 100)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '6px 4px', minHeight: 40 }}>↩ 마지막 보정 되돌리기</button>
                    </div>
                  )}

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
