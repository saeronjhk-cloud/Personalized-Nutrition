/**
 * ★ 세션81c — 관리자 «바코드 연결 확인» 큐. 판정·가드는 서버(src/services/kfindBarcodeReview)가 한다.
 *   정답 backends/먹선/IP/eval_kfind_barcode_review_v1 (A1~A8 · wording).
 */
import { useEffect, useState } from 'react'
import {
  listKfindBarcodes, decideKfindBarcode, kfbReasonKo, kfbSourceKo, kfbBlockedText, AdminApiError,
  KFB_APPROVE, KFB_REJECT, KFB_REOPEN, type KfbItem,
} from '../lib/meokseonAdmin'

const smallBtn = { width: 'auto', padding: '6px 14px', whiteSpace: 'nowrap' as const }
type St = 'needs_review' | 'approved' | 'rejected'
const ST_KO: Record<St, string> = { needs_review: '확인 대기', approved: '승인됨', rejected: '반려됨' }

export default function KfindBarcodeQueue() {
  const [st, setSt] = useState<St>('needs_review')
  const [reason, setReason] = useState<string | null>(null)
  const [data, setData] = useState<{ total: number; by_reason: Record<string, number>; items: KfbItem[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load(s: St = st, r: string | null = reason) {
    try { setData(await listKfindBarcodes(s, r)) } catch (e: any) { setMsg(e?.message || '목록을 불러오지 못했어요.') }
  }
  useEffect(() => { load(st, reason) }, [st, reason]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(it: KfbItem, action: 'approve' | 'reject' | 'reopen') {
    setBusy(true); setMsg(null)
    try {
      const r = await decideKfindBarcode(it.barcode, it.food_cd, action)
      const label = action === 'approve' ? '승인' : action === 'reject' ? '반려' : '되돌리기'
      setMsg(r.changed ? `${label} 완료 · ${it.barcode}${r.siblings_changed ? ` · 같은 바코드 다른 품목 ${r.siblings_changed}건 함께 처리` : ''}` : '이미 그 상태예요.')
      await load()
    } catch (e: any) {
      setMsg((e instanceof AdminApiError && kfbBlockedText(e.code)) || e?.message || '처리하지 못했어요.')
    } finally { setBusy(false) }
  }

  const items = data?.items || []
  return (
    <div data-testid="kfb-queue">
      <div className="survey-card" style={{ marginBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {(['needs_review', 'approved', 'rejected'] as St[]).map((s) => (
            <button key={s} type="button" className={st === s ? 'btn btn-primary' : 'btn btn-secondary'} style={smallBtn}
              onClick={() => { setSt(s); setReason(null) }}>{ST_KO[s]}</button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
          {ST_KO[st]} {data?.total ?? '-'}건 ·{' '}
          {Object.entries(data?.by_reason || {}).map(([r, n]) => (
            <button key={r} type="button" onClick={() => setReason(reason === r ? null : r)}
              style={{ background: 'none', border: 'none', padding: 0, marginRight: 8, cursor: 'pointer', fontSize: 12, textDecoration: reason === r ? 'underline' : 'none', color: 'var(--text-secondary)' }}>
              {kfbReasonKo(r || null)} {n}
            </button>
          ))}
        </p>
        {msg && <p style={{ fontSize: 13, marginTop: 'var(--space-2)' }} data-testid="kfb-msg">{msg}</p>}
      </div>
      {items.length === 0 && <div className="survey-card"><p style={{ fontSize: 14 }}>비어 있어요.</p></div>}
      {items.map((it) => (
        <div key={`${it.barcode}|${it.food_cd}`} className="survey-card" style={{ marginBottom: 'var(--space-2)' }}>
          <div style={{ fontWeight: 700 }}>{it.kfind.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            바코드 {it.barcode} · {it.kfind.maker || it.kfind.importer || '-'} · 품목보고번호 {it.kfind.report_no || '-'}
            {it.kfind.calories != null && ` · ${it.kfind.calories}kcal/${it.kfind.basis === 'per_100ml' ? '100ml' : '100g'}`}
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {kfbSourceKo(it.source)} · {kfbReasonKo(it.reason)}{it.source === 'user' ? ` · 연결한 사용자 ${it.users}명` : ''}
          </div>
          {it.source === 'haccp' && it.evidence?.haccp_name && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>HACCP 이름: {it.evidence.haccp_name} · {it.evidence.haccp_maker || '-'}</div>
          )}
          {it.public_product && <div style={{ fontSize: 12, color: '#b91c1c' }}>공공 제품: {it.public_product.product_name} (#{it.public_product.product_id})</div>}
          {it.siblings.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>같은 바코드 다른 후보: {it.siblings.map((s) => `${s.name}(${s.status})`).join(' · ')}</div>
          )}
          {it.decided_by && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>판정 {it.decided_by}</div>}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            {it.status === 'needs_review' && <>
              <button type="button" className="btn btn-primary" style={smallBtn} disabled={busy || !!it.public_product} onClick={() => act(it, 'approve')}>{KFB_APPROVE}</button>
              <button type="button" className="btn btn-secondary" style={smallBtn} disabled={busy} onClick={() => act(it, 'reject')}>{KFB_REJECT}</button>
            </>}
            {it.status !== 'needs_review' && <button type="button" className="btn btn-secondary" style={smallBtn} disabled={busy} onClick={() => act(it, 'reopen')}>{KFB_REOPEN}</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
