import { useState, useEffect } from 'react'
import {
  listMeals, deleteMeal, summarizeMeals, slotLabel, titleOf, kcalOf,
  type MealRecord, type MealStat,
} from '../lib/mealHistory'
import { leftoverStatusLabel } from '../lib/mealDetail'
import { MEAL_SAVED_EDIT_ENABLED, MEAL_FLOW_V2_ENABLED } from '../lib/flags'
import { track } from '../lib/events'
import type { MealFood } from '../lib/nutrilens'
import MealSavedEditPanel from './MealSavedEditPanel'
import LeftoverPanel from './LeftoverPanel'
import MealDetail from './MealDetail'

// 내 최근 식사(리텐션). 먹은 양 패널은 LeftoverPanel(설계 LOCK v2, IP 90 — 동작 동일).
// 표시는 DB 값(adjusted_summary·eaten_ratio·leftover_method)만 — 반영 후 load() 로 재조회(원칙5).
// 식사 흐름 v2(MEAL_FLOW_V2_ENABLED): 요약 행을 누르면 상세 → 상세 안에 «음식 고치기» / «먹은 양».

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

const actionBtn = (active: boolean) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', minHeight: 48, padding: '0 var(--space-3)',
  background: 'var(--border-light)', color: active ? 'var(--text)' : 'var(--text-secondary)', border: 'none',
  borderRadius: 'var(--radius-sm, 8px)', fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
} as const)

export default function MealHistory({ reloadKey = 0 }: { reloadKey?: number }) {
  const [items, setItems] = useState<MealRecord[]>([])
  const [stat, setStat] = useState<MealStat | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)     // 먹은 양 패널
  const [editId, setEditId] = useState<string | null>(null)     // 음식 고치기 패널
  const [detailId, setDetailId] = useState<string | null>(null) // v2 상세

  async function load() {
    setLoading(true)
    const list = await listMeals()
    setItems(list)
    setStat(summarizeMeals(list))
    setLoading(false)
  }
  useEffect(() => { load() }, [reloadKey])

  if (loading && !items.length) return null
  if (!items.length) return null

  function toggleLeftover(r: MealRecord) {
    if (openId === r.id) { setOpenId(null); return }
    setOpenId(r.id); setEditId(null)
    track('meal_leftover_open', { mode: 'all' })
  }
  function toggleEdit(r: MealRecord) {
    setOpenId(null); setEditId(editId === r.id ? null : r.id)
  }
  function toggleDetail(r: MealRecord) {
    setOpenId(null); setEditId(null); setDetailId(detailId === r.id ? null : r.id)
  }
  function afterApplied() { setOpenId(null); load() }

  return (
    <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <h3 className="survey-step-title" style={{ fontSize: 16 }}>내 최근 식사</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>총 {stat?.total ?? 0}건</span>
      </div>
      {stat && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', lineHeight: 1.6 }}>
          오늘 {stat.todayCount}끼 · 약 {stat.todayKcal} kcal · 최근 7일 {stat.last7Days}끼
          {MEAL_FLOW_V2_ENABLED && <><br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>식사를 누르면 자세히 보고 고칠 수 있어요.</span></>}
        </p>
      )}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.slice(0, 8).map((r) => {
          const status = leftoverStatusLabel(r)
          const isOpen = openId === r.id
          const isDetail = MEAL_FLOW_V2_ENABLED && detailId === r.id
          const foods = (r.foods ?? []) as MealFood[]
          const sub = `${slotLabel(r.meal_slot)} · ${kcalOf(r)} kcal${status ? ' (보정됨)' : ''} · ${new Date(r.eaten_at).toLocaleDateString()}`
          const thumb = r.thumbUrl
            ? <img src={r.thumbUrl} alt="" style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
            : <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--border-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🍽️</span>
          const leftoverPanel = isOpen && (
            <LeftoverPanel mealId={r.id} foods={foods} hasAdjustment={!!status}
              initialPct={typeof r.eaten_ratio === 'number' ? Math.round(r.eaten_ratio * 100) : 100}
              order={MEAL_FLOW_V2_ENABLED ? 'v2' : 'v1'} onApplied={afterApplied} />
          )
          const editPanel = MEAL_SAVED_EDIT_ENABLED && editId === r.id && (
            <MealSavedEditPanel record={r} onClose={() => setEditId(null)} onSaved={() => { setEditId(null); load() }} />
          )
          return (
            <li key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {/* 요약 행: 썸네일 · 음식명/kcal · 삭제 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {MEAL_FLOW_V2_ENABLED ? (
                  <button type="button" aria-label={`${titleOf(r)} 자세히 보기`} aria-expanded={isDetail} onClick={() => toggleDetail(r)}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', minHeight: 48 }}>
                    {thumb}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(r)}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{sub}</span>
                    </span>
                    <Chevron open={isDetail} />
                  </button>
                ) : (
                  <>
                    {thumb}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(r)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
                    </div>
                  </>
                )}
                <button type="button" className="btn btn-secondary" aria-label="삭제"
                  style={{ width: 'auto', minHeight: 40, padding: 'var(--space-2) var(--space-3)', color: 'var(--text-muted)', flexShrink: 0 }}
                  onClick={async () => { if (await deleteMeal(r)) load() }}>✕</button>
              </div>

              {MEAL_FLOW_V2_ENABLED ? (
                isDetail && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: '0 var(--space-1)' }}>
                    <MealDetail record={r} />
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {MEAL_SAVED_EDIT_ENABLED && (
                        <button type="button" aria-label="음식 고치기" aria-expanded={editId === r.id} onClick={() => toggleEdit(r)}
                          style={{ ...actionBtn(editId === r.id), flex: 1, flexDirection: 'column', gap: 0, padding: 'var(--space-1) var(--space-2)' }}>
                          <span>🍽 음식 고치기</span><span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>무엇을 먹었나</span>
                        </button>
                      )}
                      <button type="button" aria-label="먹은 양 조절" aria-expanded={isOpen} onClick={() => toggleLeftover(r)}
                        style={{ ...actionBtn(isOpen || !!status), flex: 1, flexDirection: 'column', gap: 0, padding: 'var(--space-1) var(--space-2)' }}>
                        <span>⚖️ {status ?? '먹은 양'}</span><span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>얼마나 먹었나</span>
                      </button>
                    </div>
                    {editPanel}
                    {leftoverPanel}
                  </div>
                )
              ) : (
                <>
                  {/* 액션 행(v1): '먹은 양' 진입점(상시·상태 겸용, 우측 정렬) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                    {MEAL_SAVED_EDIT_ENABLED && (
                      <button type="button" aria-label="음식 수정" aria-expanded={editId === r.id} onClick={() => toggleEdit(r)}
                        style={actionBtn(false)}>음식 수정</button>
                    )}
                    <button type="button" aria-label="먹은 양 조절" aria-expanded={isOpen} onClick={() => toggleLeftover(r)}
                      style={actionBtn(!!status)}>
                      <AdjustIcon />
                      {status ?? '먹은 양'}
                      <Chevron open={isOpen} />
                    </button>
                  </div>
                  {editPanel}
                  {leftoverPanel}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
