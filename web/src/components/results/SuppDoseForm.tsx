/** 합계 점검 v0 — 라벨 «1일 섭취량 기준 함량» 입력(선택). 판정은 domain/supplement/ul_check.ts 한 곳. */
import type { DoseStore, DoseValue } from '../../domain/supplement/ul_dose'
import type { DOSE_PRODUCTS } from '../../domain/supplement/ul_dose'
import { UL_NOTICE, type DoseUnit, type UlNutrientId } from '../../domain/supplement/ul_check'

interface Props {
  products: typeof DOSE_PRODUCTS[number][]
  store: DoseStore
  onChange: (next: DoseStore) => void
}

export default function SuppDoseForm({ products, store, onChange }: Props) {
  const set = (pid: string, n: UlNutrientId, patch: Partial<DoseValue>, units: readonly DoseUnit[]) => {
    const prev = store[pid]?.[n] ?? { v: '', u: units[0] }
    const nextVal = { ...prev, ...patch }
    const rec = { ...(store[pid] ?? {}) }
    if (nextVal.v.trim() === '') delete rec[n]
    else rec[n] = nextVal
    onChange({ ...store, [pid]: rec })
  }
  return (
    <div data-testid="supp-dose-form" style={{ marginTop: 'var(--space-3)', fontSize: 13, color: 'var(--text-secondary)' }}>
      <div style={{ marginBottom: 'var(--space-2)', lineHeight: 1.6 }}>
        제품 라벨의 «1일 섭취량 기준 함량»을 아는 것만 넣어 주세요. 이 기기에만 저장돼요.
      </div>
      {products.map((p) => (
        <div key={p.id} style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{p.label}</div>
          {p.fields.map((f) => {
            const cur = store[p.id]?.[f.n]
            const unit = cur?.u ?? f.units[0]
            return (
              <label key={f.n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ flex: '1 1 auto', minWidth: 0 }}>{f.label}</span>
                <input
                  type="number" inputMode="decimal" min={0} step="any"
                  aria-label={`${p.label} ${f.label} 함량`}
                  value={cur?.v ?? ''}
                  onChange={(e) => set(p.id, f.n, { v: e.target.value, u: unit }, f.units)}
                  style={{ width: 90, padding: '4px 6px' }}
                />
                {f.units.length > 1 ? (
                  <select aria-label={`${p.label} ${f.label} 단위`} value={unit}
                    onChange={(e) => set(p.id, f.n, { v: cur?.v ?? '', u: e.target.value as DoseUnit }, f.units)}>
                    {f.units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : <span style={{ width: 56 }}>{unit}</span>}
              </label>
            )
          })}
        </div>
      ))}
      <div data-testid="supp-dose-notice" style={{ fontSize: 12, lineHeight: 1.6 }}>{UL_NOTICE}</div>
    </div>
  )
}
