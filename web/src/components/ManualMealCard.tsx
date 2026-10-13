import { useState } from 'react'
import FoodEditPanel from './FoodEditPanel'
import CoachAvatar from './CoachAvatar'
import { emptyManualMeal, manualAmountText, saveManualMeal, MANUAL_MAX_FOODS } from '../lib/manualMeal'
import { addFood, removeFood, applyPortion, portionRequest, currentPortion, PORTION_CHOICES, type PortionChoice } from '../lib/foodEdit'
import { resolveFood } from '../lib/foodLookup'
import { defaultMealSlot, type AnalyzeResult } from '../lib/nutrilens'
import { track } from '../lib/events'

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const SLOTS: { key: Slot; label: string }[] = [
  { key: 'breakfast', label: '아침' }, { key: 'lunch', label: '점심' }, { key: 'dinner', label: '저녁' }, { key: 'snack', label: '간식' },
]

/**
 * «✍️ 사진 없이 기록» 카드 — 음식 이름으로 찾기(엔진 DB) → 1인분 담기 → 적게·보통·많게 → 끼니 → 저장(meal_log source 'manual').
 * 영양 숫자는 엔진이 준 값만 쓴다(FoodEditPanel → resolveFood). 설계 IP/integration/meal_manual_log_design_v1.md
 */
export default function ManualMealCard({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [meal, setMeal] = useState<AnalyzeResult>(emptyManualMeal())
  const [adding, setAdding] = useState(false)
  const [slot, setSlot] = useState<Slot>(defaultMealSlot())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [portionBusy, setPortionBusy] = useState<number | null>(null)
  const [portionFail, setPortionFail] = useState<number | null>(null)
  const foods = meal.foods
  const kcal = Math.round(Number(meal.summary.total_calories_kcal) || 0)
  const full = foods.length >= MANUAL_MAX_FOODS

  async function pickPortion(i: number, c: PortionChoice) {
    const req = portionRequest(foods[i])
    if (!req || portionBusy !== null) return
    setPortionBusy(i); setPortionFail(null)
    const r = await resolveFood(req.name, req.baseG, { portionChoice: c, riceSeparated: req.riceSeparated }).catch(() => null)
    setPortionBusy(null)
    if (!r || !r.ok || !r.food) { setPortionFail(i); return }
    const food = r.food
    setMeal((prev) => applyPortion(prev, i, food, c))
  }

  async function save() {
    setBusy(true); setErr(null)
    const r = await saveManualMeal({ result: meal, mealSlot: slot })
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? '저장에 실패했어요.'); return }
    track('meal_saved', { saved_to: 'cloud' })
    setDone(true); setMeal(emptyManualMeal()); onSaved()
  }

  function close() { setOpen(false); setAdding(false); setMeal(emptyManualMeal()); setErr(null); setPortionFail(null) }

  return (
    <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }} data-testid="manual-meal-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>✍️ 사진 없이 기록</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>사진을 못 찍었을 때, 음식 이름으로 찾아 1인분 기준으로 기록해요.</div>
        </div>
        {!open && (
          <button type="button" className="btn btn-primary" style={{ width: 'auto', padding: 'var(--space-2) var(--space-3)', flexShrink: 0 }}
            onClick={() => { setOpen(true); setDone(false); setAdding(true) }}>기록하기</button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {done && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <CoachAvatar pose="a1_thumbs" size={56} />
              <p style={{ color: 'var(--accent)', fontSize: 13 }}>✓ 기록에 저장했어요. 이어서 다른 끼니를 담을 수 있어요.</p>
            </div>
          )}
          {foods.length > 0 && (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {foods.map((f, i) => (
                <li key={i} style={{ borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name_ko}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{manualAmountText(f) ? `${manualAmountText(f)} · ` : ''}약 {Math.round(f.calories_kcal)} kcal</div>
                    </div>
                    <button type="button" className="btn btn-secondary" aria-label={`${f.name_ko} 빼기`} disabled={busy || portionBusy !== null}
                      style={{ width: 'auto', minHeight: 40, padding: 'var(--space-1) var(--space-3)', fontSize: 13, color: 'var(--text-muted)' }}
                      onClick={() => { setPortionFail(null); setMeal((m) => removeFood(m, i)) }}>빼기</button>
                  </div>
                  {portionRequest(f) && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>양</span>
                      {PORTION_CHOICES.map((c) => (
                        <button key={c} type="button" aria-pressed={currentPortion(f) === c} aria-label={`${f.name_ko} 양 ${c}`}
                          disabled={portionBusy !== null || busy}
                          onClick={() => { if (currentPortion(f) !== c) void pickPortion(i, c) }}
                          style={{
                            fontSize: 12, minHeight: 32, padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                            border: '1px solid var(--border-light)',
                            background: currentPortion(f) === c ? 'var(--accent)' : 'transparent',
                            color: currentPortion(f) === c ? '#fff' : 'var(--text-secondary)',
                          }}>{c}</button>
                      ))}
                      {portionBusy === i && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>다시 계산 중…</span>}
                      {portionFail === i && <span style={{ fontSize: 12, color: 'var(--warning)' }}>지금은 바꿀 수 없어요</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {adding && !full ? (
            <FoodEditPanel mode="add" servingG={null}
              onPicked={(food) => { setMeal((m) => addFood(m, food)); setAdding(false); setDone(false); setErr(null) }}
              onCancel={() => setAdding(false)} />
          ) : (
            !full && (
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }} disabled={busy}
                onClick={() => { setAdding(true); setDone(false) }}>＋ 음식 더 담기</button>
            )
          )}
          {full && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>한 끼에 {MANUAL_MAX_FOODS}개까지 담을 수 있어요.</div>}

          {foods.length > 0 && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>합계 약 <strong style={{ color: 'var(--text)' }}>{kcal} kcal</strong> · 언제 드셨나요?</div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {SLOTS.map((s) => (
                  <button key={s.key} type="button" className={`btn ${slot === s.key ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: 'var(--space-2) 0' }} onClick={() => setSlot(s.key)}>{s.label}</button>
                ))}
              </div>
              <button type="button" className="btn btn-primary" disabled={busy || portionBusy !== null || foods.length === 0} style={{ width: '100%' }} onClick={() => void save()}>{busy ? '저장 중…' : '기록에 저장'}</button>
            </>
          )}
          {err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
          <button type="button" onClick={close}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-end', minHeight: 40 }}>닫기</button>
        </div>
      )}
    </div>
  )
}
