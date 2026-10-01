import { useState } from 'react'
import FoodEditPanel from './FoodEditPanel'
import { renameRequestServing } from '../lib/foodEdit'
import type { MealRecord } from '../lib/mealHistory'
import {
  startSavedEdit, draftRename, draftRemove, draftAdd, canSaveDraft, needsLeftoverResetConfirm,
  saveSavedEdit, EMPTY_FOODS_MSG, LEFTOVER_RESET_CONFIRM, type SavedEditDraft,
} from '../lib/mealSavedEdit'

/**
 * 저장된 식사 «음식 편집» v1 패널 (내 최근 식사 카드 안)
 * - 초안에서만 고치고 «저장»을 눌러야 DB 반영. 영양은 엔진 resolve(FoodEditPanel) 값만.
 * - 보정(먹은 양)된 식사는 저장 전에 «보정 초기화» 확인을 한 번 받는다(제이 결정 D2).
 * 설계 IP/integration/meal_saved_edit_design_v1.md
 */
export default function MealSavedEditPanel(props: { record: MealRecord; onClose: () => void; onSaved: () => void }) {
  const { record, onClose, onSaved } = props
  const [draft, setDraft] = useState<SavedEditDraft>(() => startSavedEdit(record))
  const [editing, setEditing] = useState<number | 'add' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const canSave = canSaveDraft(draft)
  const kcal = Math.round(Number(draft.summary?.total_calories_kcal) || 0)

  async function doSave() {
    setBusy(true); setErr(null)
    const res = await saveSavedEdit(record, draft)
    setBusy(false); setConfirming(false)
    if (!res.ok) { setErr(res.message); return }
    onSaved()
  }
  function onSaveClick() {
    if (!canSave) { setErr(EMPTY_FOODS_MSG); return }
    if (draft.dirty && needsLeftoverResetConfirm(record)) { setConfirming(true); return }
    void doSave()
  }

  const smallBtn = { width: 'auto', minHeight: 40, padding: 'var(--space-1) var(--space-3)', fontSize: 13 } as const
  return (
    <div data-testid="meal-saved-edit" role="region" aria-label="음식 수정"
      style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--border-light)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>음식 수정</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>합계 약 {kcal} kcal</span>
      </div>

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {draft.foods.map((f, i) => (
          <li key={f.food_item_id ?? i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 44 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name_ko}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  약 {Math.round(Number(f.calories_kcal) || 0)} kcal
                  {f.user_edit === 'renamed' ? ' · 직접 수정' : f.user_edit === 'added' ? ' · 직접 추가' : ''}
                </div>
              </div>
              {editing !== i && (
                <>
                  <button type="button" className="btn btn-secondary" disabled={busy} aria-label={`${f.name_ko} 이름 바꾸기`} style={smallBtn} onClick={() => { setErr(null); setEditing(i) }}>수정</button>
                  <button type="button" className="btn btn-secondary" disabled={busy} aria-label={`${f.name_ko} 삭제`} style={{ ...smallBtn, color: 'var(--text-muted)' }}
                    onClick={() => { setEditing(null); setErr(null); setDraft((d) => draftRemove(d, i)) }}>삭제</button>
                </>
              )}
            </div>
            {editing === i && (
              <FoodEditPanel mode="rename" servingG={renameRequestServing(f)}
                onPicked={(food) => { setDraft((d) => draftRename(d, i, food)); setEditing(null) }}
                onCancel={() => setEditing(null)} />
            )}
          </li>
        ))}
      </ul>
      {draft.foods.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{EMPTY_FOODS_MSG}</div>}

      {editing === 'add' ? (
        <FoodEditPanel mode="add" servingG={null}
          onPicked={(food) => { setDraft((d) => draftAdd(d, food)); setEditing(null) }}
          onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" className="btn btn-secondary" disabled={busy} style={{ width: '100%', minHeight: 44, fontSize: 13 }}
          onClick={() => { setErr(null); setEditing('add') }}>+ 빠진 음식 추가</button>
      )}

      {confirming ? (
        <div role="alertdialog" aria-label="먹은 양 보정 초기화 확인"
          style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{LEFTOVER_RESET_CONFIRM}</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-primary" disabled={busy} style={{ flex: 1, minHeight: 44, fontSize: 13 }} onClick={() => void doSave()}>{busy ? '저장 중…' : '초기화하고 저장'}</button>
            <button type="button" className="btn btn-secondary" disabled={busy} style={{ width: 'auto', minHeight: 44, fontSize: 13, padding: '0 var(--space-3)' }} onClick={() => setConfirming(false)}>취소</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-primary" disabled={busy || !canSave || !draft.dirty} style={{ flex: 1, minHeight: 44, fontSize: 13 }} onClick={onSaveClick}>{busy ? '저장 중…' : '저장'}</button>
          <button type="button" className="btn btn-secondary" disabled={busy} style={{ width: 'auto', minHeight: 44, fontSize: 13, padding: '0 var(--space-3)' }} onClick={onClose}>취소</button>
        </div>
      )}

      {err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
      {needsLeftoverResetConfirm(record) && !confirming && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>이 식사는 «먹은 양»이 보정돼 있어요. 음식을 고치면 보정이 초기화됩니다.</div>
      )}
    </div>
  )
}
