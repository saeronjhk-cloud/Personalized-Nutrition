import { useState } from 'react'
import ProductAddPanel from './ProductAddPanel'
import CoachAvatar from './CoachAvatar'
import { productSummary, saveProductMeal } from '../lib/productLog'
import { defaultMealSlot, type MealFood } from '../lib/nutrilens'
import { track } from '../lib/events'

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const SLOTS: { key: Slot; label: string }[] = [
  { key: 'breakfast', label: '아침' }, { key: 'lunch', label: '점심' }, { key: 'dinner', label: '저녁' }, { key: 'snack', label: '간식' },
]

/** «📦 가공식품 기록» 카드 — 제품 담기(먹은 양 포함) → 끼니 → 저장(meal_log source 'barcode'). */
export default function ProductMealCard({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [foods, setFoods] = useState<MealFood[]>([])
  const [slot, setSlot] = useState<Slot>(defaultMealSlot())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const kcal = Math.round(Number(productSummary(foods).total_calories_kcal) || 0)

  async function save() {
    setBusy(true); setErr(null)
    const r = await saveProductMeal({ foods, mealSlot: slot })
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? '저장에 실패했어요.'); return }
    track('meal_saved', { saved_to: 'cloud' })
    setDone(true); setFoods([]); onSaved()
  }

  return (
    <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }} data-testid="product-meal-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>📦 가공식품 기록</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>과자·음료·라면 등은 바코드나 이름으로 찾아 먹은 양과 함께 기록해요.</div>
        </div>
        {!open && (
          <button type="button" className="btn btn-primary" style={{ width: 'auto', padding: 'var(--space-2) var(--space-3)', flexShrink: 0 }}
            onClick={() => { setOpen(true); setDone(false) }}>기록하기</button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {done && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <CoachAvatar pose="a1_thumbs" size={56} />
              <p style={{ color: 'var(--accent)', fontSize: 13 }}>✓ 기록에 저장했어요. 이어서 다른 제품을 담을 수 있어요.</p>
            </div>
          )}
          {foods.length > 0 && (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {foods.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-1)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name_ko}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.amount} · 약 {Math.round(f.calories_kcal)} kcal</div>
                  </div>
                  <button type="button" className="btn btn-secondary" aria-label={`${f.name_ko} 빼기`} disabled={busy}
                    style={{ width: 'auto', minHeight: 40, padding: 'var(--space-1) var(--space-3)', fontSize: 13, color: 'var(--text-muted)' }}
                    onClick={() => setFoods((xs) => xs.filter((_, j) => j !== i))}>빼기</button>
                </li>
              ))}
            </ul>
          )}

          <ProductAddPanel onAdd={(f) => { setFoods((xs) => [...xs, f]); setDone(false) }} />

          {foods.length > 0 && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>합계 약 <strong style={{ color: 'var(--text)' }}>{kcal} kcal</strong> · 언제 드셨나요?</div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {SLOTS.map((s) => (
                  <button key={s.key} type="button" className={`btn ${slot === s.key ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: 'var(--space-2) 0' }} onClick={() => setSlot(s.key)}>{s.label}</button>
                ))}
              </div>
              <button type="button" className="btn btn-primary" disabled={busy || foods.length === 0} style={{ width: '100%' }} onClick={() => void save()}>{busy ? '저장 중…' : '기록에 저장'}</button>
            </>
          )}
          {err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
          <button type="button" onClick={() => { setOpen(false); setFoods([]); setErr(null) }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-end', minHeight: 40 }}>닫기</button>
        </div>
      )}
    </div>
  )
}
