import { useEffect, useState } from 'react'
import { getMyContribution, MeokseonAuthError } from '../lib/meokseon'
import {
  DETAIL_LOAD_ERROR, DETAIL_PENDING_NOTE, basisLabel, detailNutritionRows, type ContributionDetail,
} from '../domain/meokseon/contributionDetail'

/**
 * ★ 세션75d — 「내가 보낸 제보」 카드 안에서 펼치는 «내가 보낸 내용».
 *   제이 실물(10-04): 카드는 있는데 내용이 안 보였다 — 제보는 승인 전까지 제품 화면에 없다(세션66 C6).
 *   문구·판정은 domain/meokseon/contributionDetail.ts 정본만 쓴다.
 */
type Phase = 'loading' | 'ready' | 'missing' | 'need_login' | 'error'
const MUTED = { color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 } as const
const ROW = { fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 'var(--space-1) 0' } as const

export default function MyReportDetail({ id }: { id: number }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [d, setD] = useState<ContributionDetail | null>(null)
  useEffect(() => {
    let alive = true
    getMyContribution(id)
      .then((x) => { if (!alive) return; setD(x); setPhase(x ? 'ready' : 'missing') })
      .catch((e) => { if (!alive) return; setPhase(e instanceof MeokseonAuthError ? 'need_login' : 'error') })
    return () => { alive = false }
  }, [id])

  if (phase === 'loading') return <p data-testid="report-detail" style={MUTED}>불러오는 중…</p>
  if (phase === 'need_login') return <p data-testid="report-detail" style={MUTED}>다시 로그인한 뒤 볼 수 있어요.</p>
  if (phase === 'error') return <p data-testid="report-detail" style={MUTED}>{DETAIL_LOAD_ERROR}</p>
  if (phase === 'missing' || !d) return <p data-testid="report-detail" style={MUTED}>이 제보의 내용을 찾을 수 없어요.</p>

  const rows = detailNutritionRows(d)
  return (
    <div data-testid="report-detail" style={{ borderTop: '1px dashed var(--border-light)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
      {d.pending && <p style={{ ...MUTED, marginBottom: 'var(--space-2)' }}>{DETAIL_PENDING_NOTE}</p>}
      {(d.foodType || d.content) && <p style={ROW}>{[d.foodType, d.content && `내용량 ${d.content}`].filter(Boolean).join(' · ')}</p>}
      {d.allergens && (d.allergens.contains.length + d.allergens.inferred.length + d.allergens.mayContain.length > 0) && (
        <p style={ROW}>
          <strong>알레르기</strong>{' '}
          {d.allergens.contains.length > 0 && <>직접 함유: {d.allergens.contains.join(', ')}{' '}</>}
          {d.allergens.inferred.length > 0 && <>· 원재료 추정: {d.allergens.inferred.join(', ')}{' '}</>}
          {d.allergens.mayContain.length > 0 && <>· 혼입 가능: {d.allergens.mayContain.join(', ')}</>}
        </p>
      )}
      {d.ingredientsText
        ? <p style={ROW}><strong>원재료</strong> {d.ingredientsText}</p>
        : d.ingredients.length > 0 && <p style={ROW}><strong>원재료</strong> {d.ingredients.join(', ')}</p>}
      {d.additives.length > 0 && <p style={ROW}><strong>읽은 첨가물</strong> {d.additives.join(', ')}</p>}
      {rows.length > 0 && (
        <div style={{ marginTop: 'var(--space-1)' }}>
          <p style={{ ...ROW, marginBottom: 0 }}><strong>영양성분</strong> <span style={MUTED}>{basisLabel(d.nutrition!.basis, d.nutrition!.basisAmount)}</span></p>
          <p style={{ ...ROW, marginTop: 0 }}>{rows.map((r) => `${r.label} ${r.text}`).join(' · ')}</p>
        </div>
      )}
      {!d.ingredientsText && d.ingredients.length === 0 && rows.length === 0 && !d.allergens && d.additives.length === 0 && (
        <p style={MUTED}>이 제보에서 읽어낸 내용이 없어요.</p>
      )}
    </div>
  )
}
