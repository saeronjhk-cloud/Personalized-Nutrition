import { useState } from 'react'
import LeftoverPanel from './LeftoverPanel'
import type { MealFood } from '../lib/nutrilens'

/**
 * 저장 직후 «② 얼마나 드셨나요?» (식사 흐름 v2)
 * - 다 먹었어요 → 아무것도 바꾸지 않음(100%) · 남긴 음식 찍기 → 식후 사진(추정→확인) · 직접 조절 → 전체/음식별 %
 * - 숫자는 서버(meal-leftover) adjusted_summary 만 보여준다.
 */
export default function AfterSaveLeftover(props: { mealId: string; foods: MealFood[]; onNext: () => void }) {
  const { mealId, foods, onNext } = props
  const [open, setOpen] = useState<null | 'photo' | 'manual'>(null)
  const [doneKcal, setDoneKcal] = useState<number | null>(null)

  if (doneKcal != null) {
    return (
      <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }} data-testid="after-save-leftover">
        <p style={{ color: 'var(--accent)', fontSize: 14, marginBottom: 'var(--space-3)' }}>✅ 실제 섭취 약 {doneKcal} kcal로 기록했어요.</p>
        <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onNext}>다른 식사 기록하기</button>
      </div>
    )
  }
  const row = (active: boolean) => ({
    width: '100%', minHeight: 52, padding: 'var(--space-2) var(--space-3)', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 'var(--space-2)', textAlign: 'left' as const, fontSize: 14, fontWeight: active ? 700 : 600,
  })
  const sub = { fontSize: 12, fontWeight: 400, opacity: 0.8 } as const
  return (
    <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }} data-testid="after-save-leftover">
      <p style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 'var(--space-2)' }}>✓ 기록에 저장했어요.</p>
      <h3 className="survey-step-title" style={{ fontSize: 16, marginBottom: 'var(--space-1)' }}>② 얼마나 드셨나요?</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.6 }}>
        남긴 음식이 있으면 반영해서 실제로 먹은 양으로 기록해요. 지금 안 해도 돼요 — 다 드신 뒤 «내 최근 식사»에서 해도 됩니다.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: open ? 'var(--space-3)' : 0 }}>
        <button type="button" className="btn btn-secondary" style={row(false)} onClick={onNext}>
          <span>🍽 다 먹었어요</span><span style={sub}>그대로 기록</span>
        </button>
        <button type="button" className={`btn ${open === 'photo' ? 'btn-primary' : 'btn-secondary'}`} style={row(open === 'photo')} onClick={() => setOpen(open === 'photo' ? null : 'photo')}>
          <span>📷 남긴 음식 찍기</span><span style={sub}>사진으로 추정</span>
        </button>
        <button type="button" className={`btn ${open === 'manual' ? 'btn-primary' : 'btn-secondary'}`} style={row(open === 'manual')} onClick={() => setOpen(open === 'manual' ? null : 'manual')}>
          <span>⚖️ 직접 조절</span><span style={sub}>% 로 정하기</span>
        </button>
      </div>
      {open && (
        <LeftoverPanel key={open} mealId={mealId} foods={foods} hasAdjustment={false} order="v2" hideTitle
          onApplied={(adj) => setDoneKcal(Math.round(Number(adj?.total_calories_kcal) || 0))}
          {...(open === 'manual' ? { startMode: 'all' as const } : {})} />
      )}
    </div>
  )
}
