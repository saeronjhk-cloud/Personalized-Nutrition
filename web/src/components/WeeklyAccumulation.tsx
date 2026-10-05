import { useEffect, useState } from 'react'
import { getAdditiveSummary, meokseonConfigured } from '../lib/meokseon'
import {
  accumulationView, aggregateWeeklyAdditives, WEEKLY_ADDITIVE_TITLE, WEEKLY_GRADE_NOTICE, ADDITIVE_COUNT_CAVEAT,
  type Accumulation, type WeeklyAdditivesView,
} from '../lib/weeklyAccumulation_view'

/**
 * 주간 리포트 누적 v1 — «이번 주 나트륨·당류» + «이번 주 가공식품»(설계 weekly_accumulation_design_v1 D5·D6)
 * 숫자는 엔진 accumulation 그대로. 첨가물은 먹선 /additives 의 «이름»만(등급·색 비표시).
 */
export default function WeeklyAccumulation({ accumulation }: { accumulation?: Accumulation | null }) {
  const v = accumulationView({ accumulation })
  const barcodes = (accumulation?.processed?.products ?? []).map((p) => p.barcode)
  const key = barcodes.join(',')
  const [adds, setAdds] = useState<WeeklyAdditivesView | null>(null)

  useEffect(() => {
    setAdds(null)
    if (!key || !meokseonConfigured()) return
    let alive = true
    const list = key.split(',')
    Promise.all(list.map((bc) => getAdditiveSummary(bc).then((s) => ({ barcode: bc, summary: s }), () => ({ barcode: bc, summary: null }))))
      .then((rs) => { if (alive) setAdds(aggregateWeeklyAdditives(rs)) })
    return () => { alive = false }
  }, [key])

  if (!v) return null
  return (
    <>
      <section style={{ marginBottom: 'var(--space-4)' }}>
        <div style={sectionTitle}>이번 주 나트륨·당류</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {v.rows.map((r) => (
            <div key={r.key} style={card}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text)' }}>{r.avgText}</span>
              </div>
              <div style={sub}>{r.overText}</div>
              {r.shareText && <div style={sub}>{r.shareText}</div>}
              {r.unknownNote && <div style={note}>{r.unknownNote}</div>}
            </div>
          ))}
          {v.excludedNote && <div style={note}>{v.excludedNote}</div>}
        </div>
      </section>

      {v.products.show && (
        <section style={{ marginBottom: 'var(--space-4)' }}>
          <div style={sectionTitle}>이번 주 가공식품</div>
          <div style={card}>
            {v.products.items.map((p, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 14, color: 'var(--text)', padding: '2px 0' }}>
                <span>📦 {p.name}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{p.countText}</span>
              </div>
            ))}
            {v.products.moreText && <div style={sub}>{v.products.moreText}</div>}

            {adds && (adds.names.length > 0 || adds.failedNote || adds.unlistedNote) && (
              <div style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--border, rgba(0,0,0,0.1))', paddingTop: 'var(--space-2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{WEEKLY_ADDITIVE_TITLE} {adds.names.length}개</div>
                <div style={note}>{WEEKLY_GRADE_NOTICE}</div>
                {adds.names.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--space-2)' }}>
                    {adds.names.map((a) => (
                      <span key={a.name} style={pill}>{a.name}{a.productCount > 1 ? ` · ${a.productCount}개 제품` : ''}</span>
                    ))}
                  </div>
                )}
                {adds.unlistedNote && <div style={note}>{adds.unlistedNote}</div>}
                {adds.failedNote && <div style={note}>{adds.failedNote}</div>}
                <div style={note}>{ADDITIVE_COUNT_CAVEAT}</div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  )
}

const card: React.CSSProperties = {
  border: '1px solid var(--border, rgba(0,0,0,0.1))', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', background: 'var(--surface, #fff)',
}
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }
const sub: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }
const note: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }
const pill: React.CSSProperties = {
  display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-2, rgba(0,0,0,0.05))', fontSize: 12, color: 'var(--text)',
}
