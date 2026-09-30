import { useEffect, useRef, useState } from 'react'
import { searchFoods, resolveFood, type FoodCandidate } from '../lib/foodLookup'
import type { ResolvedFood } from '../lib/foodEdit'

/**
 * 음식 편집 v1 — 음식 찾기 패널 (이름 바꾸기 / 추가 공용)
 * - 후보는 엔진 음식 DB 에서만(자유 입력으로 영양을 만들지 않는다).
 * - 고르면 엔진 resolve → onPicked(확정 음식). 영양 숫자는 여기서 만들지 않는다.
 * - rename: servingG = 사진 추정량(유지) · add: null(엔진 1인분)
 */
export default function FoodEditPanel(props: {
  mode: 'rename' | 'add'
  initialQuery?: string
  servingG: number | null
  onPicked: (food: ResolvedFood) => void
  onCancel: () => void
}) {
  const { mode, initialQuery = '', servingG, onPicked, onCancel } = props
  const [q, setQ] = useState(initialQuery)
  const [items, setItems] = useState<FoodCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const query = q.trim()
    if (!query) { setItems([]); setMsg(null); return }
    const my = ++seq.current
    const t = setTimeout(async () => {
      setLoading(true)
      const r = await searchFoods(query)
      if (my !== seq.current) return // 늦게 온 옛 응답 무시
      setLoading(false)
      if (!r.ok) { setItems([]); setMsg(r.message); return }
      setItems(r.items)
      setMsg(r.items.length === 0 ? '목록에 없는 음식이에요. 다른 이름으로 찾아보시거나 «의견 보내기»로 알려 주세요.' : null)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  async function pick(c: FoodCandidate) {
    setLoading(true)
    const r = await resolveFood(c.name_ko, mode === 'rename' ? servingG : null)
    setLoading(false)
    if (!r.ok) { setMsg(r.message); return }
    if (!r.food) { setMsg('이 음식은 지금 영양 정보를 불러올 수 없어요. 다른 이름을 골라 주세요.'); return }
    onPicked(r.food)
  }

  return (
    <div data-testid="food-edit-panel" style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)' }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
        {mode === 'rename' ? '어떤 음식이었나요? (양은 사진 기준 그대로)' : '추가할 음식을 찾아 주세요 (1인분 기준)'}
      </div>
      <input
        autoFocus type="search" value={q} maxLength={30} placeholder="예: 소고기국밥"
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', minHeight: 44, padding: 'var(--space-2) var(--space-3)', fontSize: 15, border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text)', boxSizing: 'border-box' }}
      />
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>찾는 중…</div>}
      {msg && !loading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-2)', lineHeight: 1.6 }}>{msg}</div>}
      {items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {items.map((c) => (
            <li key={c.name_ko}>
              <button type="button" disabled={loading} onClick={() => pick(c)}
                style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontSize: 14, cursor: 'pointer', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text)', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                <span>{c.name_ko}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>1인분 {c.serving_g}g · 약 {Math.round(c.calories_kcal)}kcal</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 'var(--space-2)', minHeight: 40 }} onClick={onCancel}>취소</button>
    </div>
  )
}
