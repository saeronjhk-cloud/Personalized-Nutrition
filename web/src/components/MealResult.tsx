import type { AnalyzeResult, MealFood } from '../lib/nutrilens'
import { alternatesOf } from '../lib/foodCorrection'

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
}) {
  const { result, previewUrl, slot, onSlot, saved, busy, onSave, onReset, onCorrect } = props
  return (
    <>
      {previewUrl && (
        <img src={previewUrl} alt="식사 사진" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
      )}

      <div className="survey-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 className="survey-step-title" style={{ fontSize: 16 }}>분석 결과</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>사진 기준 추정</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {MACROS.map(({ key, label, unit }) => (
            <span key={key} style={{ fontSize: 13, padding: '5px 11px', borderRadius: 999, background: 'var(--border-light)', color: 'var(--text)' }}>
              {label} <strong>{Math.round(num((result.summary as any)[`total_${key}`]) * 10) / 10}</strong> {unit}
            </span>
          ))}
        </div>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.foods.map((f, i) => (
            <li key={i} style={{ borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 15 }}>{f.name_ko || '음식'}</strong>
                {f.amount && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.amount}</span>}
                {isLowConfidence(f) && (
                  <span style={{ fontSize: 11, color: 'var(--warning)', background: 'var(--border-light)', padding: '2px 7px', borderRadius: 999 }}>확인 필요</span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                {MACROS.map(({ key, label, unit }) => (
                  <span key={key}>{label} {Math.round(num(f[key]) * 10) / 10}{unit}</span>
                ))}
              </div>
              {/* 세션52 — 사진만으로는 구별할 수 없는 쌍(설렁탕↔곰탕 · 꽃게탕↔해물탕).
                  엔진도 GPT 도 못 가리므로 하나를 골라 보여주되, 한 번에 고칠 수 있게 한다.
                  누르면 이름과 영양이 «함께» 바뀐다(applyAlternate). 다시 누르면 되돌아간다. */}
              {onCorrect && !saved && alternatesOf(f).length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>혹시 이거였나요?</span>
                  {alternatesOf(f).map((alt) => (
                    <button key={alt.name_ko} type="button"
                      onClick={() => onCorrect(i, alt.name_ko)}
                      style={{
                        fontSize: 12, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
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
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
          사진 분석은 추정치이며 실제와 다를 수 있어요. 진단이 아닌 생활관리 참고용입니다.
        </p>
      </div>

      {saved ? (
        <div className="survey-card" style={{ marginBottom: 16 }}>
          <p style={{ color: 'var(--accent)', fontSize: 14, marginBottom: 12 }}>✓ 기록에 저장했어요.</p>
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onReset}>다른 식사 기록하기</button>
        </div>
      ) : (
        <div className="survey-card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>언제 먹은 식사인가요?</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {SLOTS.map((s) => (
              <button key={s.key} type="button"
                className={`btn ${slot === s.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '9px 0' }}
                onClick={() => onSlot(s.key)}>{s.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onReset} disabled={busy}>다시</button>
            <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={onSave} disabled={busy}>
              {busy ? '저장 중…' : '기록에 저장'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
