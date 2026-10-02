import { useState, type ReactNode } from 'react'
import type { AnalyzeResult, MealFood } from '../lib/nutrilens'
import { alternatesOf } from '../lib/foodCorrection'
import { canSaveFoods, renameRequestServing, type ResolvedFood } from '../lib/foodEdit'
import FoodEditPanel from './FoodEditPanel'

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const SLOTS: { key: Slot; label: string }[] = [
  { key: 'breakfast', label: '아침' },
  { key: 'lunch', label: '점심' },
  { key: 'dinner', label: '저녁' },
  { key: 'snack', label: '간식' },
]
const MACROS: { key: keyof MealFood; label: string; unit: string }[] = [
  { key: 'calories_kcal', label: '열량', unit: 'kcal' },
  { key: 'protein_g', label: '단백질', unit: 'g' },
  { key: 'carbs_g', label: '탄수화물', unit: 'g' },
  { key: 'fat_g', label: '지방', unit: 'g' },
  { key: 'sugar_g', label: '당류', unit: 'g' },
  { key: 'sodium_mg', label: '나트륨', unit: 'mg' },
]
function num(v: unknown): number { return typeof v === 'number' && isFinite(v) ? v : 0 }
function isLowConfidence(f: MealFood): boolean {
  return f.match_confidence === 'low' || (f.quality_flags ?? []).includes('low_confidence')
}

export default function MealResult(props: {
  result: AnalyzeResult
  previewUrl: string | null
  slot: Slot
  onSlot: (s: Slot) => void
  saved: boolean
  busy: boolean
  onSave: () => void
  onReset: () => void
  /** 세션52 — 구별 불가 쌍 정정. 없으면 후보 칩을 그리지 않는다. */
  onCorrect?: (index: number, altName: string) => void
  /** 음식 편집 v1 (MEAL_EDIT_ENABLED) — 이름 바꾸기·삭제·추가. 저장 전에만 보인다. */
  edit?: {
    onRename: (index: number, food: ResolvedFood) => void
    onRemove: (index: number) => void
    onAdd: (food: ResolvedFood) => void
  }
  /** 식사 흐름 v2 — ① 제목·설명. afterSave 가 있으면 저장 뒤 카드를 그것으로 바꾼다(② 얼마나 드셨나요?) */
  flowV2?: boolean
  afterSave?: ReactNode
}) {
  const { result, previewUrl, slot, onSlot, saved, busy, onSave, onReset, onCorrect, edit, flowV2, afterSave } = props
  // 편집 중인 행: 음식 index · 'add' · null
  const [editing, setEditing] = useState<number | 'add' | null>(null)
  const editable = !!edit && !saved
  const canSave = canSaveFoods(result)
  return (
    <>
      {previewUrl && (
        <img src={previewUrl} alt="식사 사진" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)' }} />
      )}

      <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <h3 className="survey-step-title" style={{ fontSize: 16 }}>{flowV2 ? '① 사진 속 음식이 맞나요?' : '분석 결과'}</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>사진 기준 추정</span>
        </div>
        {flowV2 && !saved && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.6 }}>
            이름이 틀렸거나 빠진 음식이 있으면 고쳐 주세요. 얼마나 드셨는지는 저장한 뒤에 정해요.
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {MACROS.map(({ key, label, unit }) => (
            <span key={key} style={{ fontSize: 13, padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-pill)', background: 'var(--border-light)', color: 'var(--text)' }}>
              {label} <strong>{Math.round(num((result.summary as any)[`total_${key}`]) * 10) / 10}</strong> {unit}
            </span>
          ))}
        </div>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {result.foods.map((f, i) => (
            <li key={i} style={{ borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                <strong style={{ fontSize: 15 }}>{f.name_ko || '음식'}</strong>
                {f.amount && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.amount}</span>}
                {isLowConfidence(f) && (
                  <span style={{ fontSize: 11, color: 'var(--warning)', background: 'var(--border-light)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-pill)' }}>확인 필요</span>
                )}
                {f.user_edit && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.user_edit === 'added' ? '직접 추가' : '직접 수정'}</span>
                )}
                {editable && editing !== i && (
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-1)' }}>
                    <button type="button" aria-label={`${f.name_ko} 이름 바꾸기`} onClick={() => setEditing(i)}
                      style={{ fontSize: 12, minHeight: 32, padding: 'var(--space-1) var(--space-2)', cursor: 'pointer', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-pill)', background: 'transparent', color: 'var(--text-secondary)' }}>수정</button>
                    <button type="button" aria-label={`${f.name_ko} 삭제`} onClick={() => { setEditing(null); edit!.onRemove(i) }}
                      style={{ fontSize: 12, minHeight: 32, padding: 'var(--space-1) var(--space-2)', cursor: 'pointer', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-pill)', background: 'transparent', color: 'var(--text-secondary)' }}>삭제</button>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', fontSize: 13, color: 'var(--text-secondary)' }}>
                {MACROS.map(({ key, label, unit }) => (
                  <span key={key}>{label} {Math.round(num(f[key]) * 10) / 10}{unit}</span>
                ))}
              </div>
              {/* 세션52 — 사진만으로는 구별할 수 없는 쌍(설렁탕↔곰탕 · 꽃게탕↔해물탕).
                  엔진도 GPT 도 못 가리므로 하나를 골라 보여주되, 한 번에 고칠 수 있게 한다.
                  누르면 이름과 영양이 «함께» 바뀐다(applyAlternate). 다시 누르면 되돌아간다. */}
              {onCorrect && !saved && alternatesOf(f).length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>혹시 이거였나요?</span>
                  {alternatesOf(f).map((alt) => (
                    <button key={alt.name_ko} type="button"
                      onClick={() => onCorrect(i, alt.name_ko)}
                      style={{
                        fontSize: 12, padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                        border: '1px solid var(--border-light)', background: 'transparent',
                        color: 'var(--text-secondary)',
                      }}>
                      {alt.name_ko}
                      {typeof alt.calories_kcal === 'number' && (
                        <span style={{ color: 'var(--text-muted)' }}> {Math.round(alt.calories_kcal)}kcal</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {editable && editing === i && (
                <FoodEditPanel mode="rename" initialQuery="" servingG={renameRequestServing(f)}
                  onPicked={(food) => { edit!.onRename(i, food); setEditing(null) }}
                  onCancel={() => setEditing(null)} />
              )}
            </li>
          ))}
        </ul>
        {editable && result.foods.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--warning)', marginTop: 'var(--space-2)' }}>음식을 하나 이상 남겨 주세요.</p>
        )}
        {editable && (editing === 'add' ? (
          <FoodEditPanel mode="add" servingG={null}
            onPicked={(food) => { edit!.onAdd(food); setEditing(null) }}
            onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 'var(--space-3)', minHeight: 44 }}
            onClick={() => setEditing('add')}>+ 빠진 음식 추가</button>
        ))}
        <p style={{ fontSize: 'var(--font-caption)', color: 'var(--text-muted)', marginTop: 'var(--space-3)', lineHeight: 1.6 }}>
          사진 분석은 추정치이며 실제와 다를 수 있어요. 진단이 아닌 생활관리 참고용입니다.
        </p>
      </div>

      {saved && afterSave ? afterSave : saved ? (
        <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ color: 'var(--accent)', fontSize: 14, marginBottom: 'var(--space-3)' }}>✓ 기록에 저장했어요.</p>
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onReset}>다른 식사 기록하기</button>
        </div>
      ) : (
        <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>언제 먹은 식사인가요?</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            {SLOTS.map((s) => (
              <button key={s.key} type="button"
                className={`btn ${slot === s.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: 'var(--space-2) 0' }}
                onClick={() => onSlot(s.key)}>{s.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onReset} disabled={busy}>다시</button>
            <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={onSave} disabled={busy || !canSave}>
              {busy ? '저장 중…' : '기록에 저장'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
