import type { MealRecord } from '../lib/mealHistory'
import { mealDetailView } from '../lib/mealDetail'

/** 식사 기록 상세(식사 흐름 v2) — 저장값 표시만. 숫자 산식 없음(반올림만). */
export default function MealDetail({ record }: { record: MealRecord }) {
  const v = mealDetailView(record)
  return (
    <div data-testid="meal-detail" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-2) 0' }}>
      {record.thumbUrl && (
        <img src={record.thumbUrl} alt="식사 사진" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {v.when}{record.meal_session_id ? ' · 🍱 정찬' : ''}{record.source === 'barcode' ? ' · 📦 가공식품' : ''}
      </div>
      {v.kcalBefore != null && (
        <div style={{ fontSize: 13, color: 'var(--text)', background: 'var(--border-light)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)' }}>
          원래 {v.kcalBefore} kcal → 먹은 양 반영 <strong>{v.kcalAfter} kcal</strong>{v.status ? ` (${v.status})` : ''}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
        {v.chips.map((c) => (
          <span key={c.label} style={{ fontSize: 12, padding: '2px var(--space-2)', borderRadius: 'var(--radius-pill)', background: 'var(--border-light)', color: 'var(--text)' }}>
            {c.label} <strong>{c.value}</strong> {c.unit}
          </span>
        ))}
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
        {v.foods.map((f) => (
          <li key={f.key} style={{ borderTop: '1px solid var(--border-light)', padding: 'var(--space-2) 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}{f.amountText != null && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}> · {f.amountText}</span>}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text)', flexShrink: 0 }}>{f.kcal} kcal</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              탄수 {f.carbs}g · 단백질 {f.protein}g · 지방 {f.fat}g{f.mark ? ` · ${f.mark}` : ''}{f.partial ? ' · 일부 영양 정보 없음' : ''}
            </div>
          </li>
        ))}
      </ul>
      {v.kcalBefore != null && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>음식별 숫자는 사진 기준(먹은 양 반영 전)이고, 위 합계는 먹은 양을 반영한 값이에요.</div>
      )}
    </div>
  )
}
