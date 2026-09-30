/**
 * ★ 세션72d — 앱 안 관리자 화면 (/admin · 제이 결정 2026-09-30)
 *   · 메뉴에 없다. 관리자 계정(ADMIN_EMAILS)만 서버가 통과시킨다 — 일반 사용자가 주소를 쳐도 403 화면.
 *   · 할 수 있는 일: 검토 대기 목록 → 제품 펼치기(제보 값) → 축별 승인/반려 · 자동반영 목록 → 되돌리기.
 *   · 값 정정·기준 채우기 같은 고급 작업은 기존 화면(contribution-review.html) 링크로 보낸다(두 벌 금지).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  adminWhoami, listReviewQueue, getReviewDetail, verifyReviews, gateFromError,
  describeProposed, axisKo, statusKo, MEOKSEON_BASE, type AdminGate,
} from '../lib/meokseonAdmin'

type Tab = 'pending' | 'auto'
const TAB_STATUS: Record<Tab, string[]> = { pending: ['candidate', 'approved'], auto: ['auto_applied'] }

export default function Admin() {
  const navigate = useNavigate()
  const [gate, setGate] = useState<AdminGate | 'checking'>('checking')
  const [email, setEmail] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pending')
  const [data, setData] = useState<any>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    let alive = true
    adminWhoami()
      .then((w) => { if (alive) { setEmail(w.email); setGate('ok') } })
      .catch((e) => { if (alive) setGate(gateFromError(e)) })
    return () => { alive = false }
  }, [])

  async function load(t: Tab = tab) {
    setMsg(null)
    try { setData(await listReviewQueue(TAB_STATUS[t])) } catch (e: any) { setMsg(e?.message || '목록을 불러오지 못했어요.') }
  }
  useEffect(() => { if (gate === 'ok') { setOpen(null); setDetail(null); load(tab) } }, [gate, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(pid: number) {
    if (open === pid) { setOpen(null); setDetail(null); return }
    setOpen(pid); setDetail(null)
    try { setDetail(await getReviewDetail(pid)) } catch (e: any) { setMsg(e?.message || '상세를 불러오지 못했어요.') }
  }

  async function act(pid: number, action: 'approve' | 'reject' | 'undo', reviewIds: number[]) {
    if (action === 'reject' && !reason.trim()) { setMsg('반려 사유를 먼저 적어 주세요.'); return }
    setBusy(true); setMsg(null)
    try {
      const r = await verifyReviews(pid, { action, review_ids: reviewIds, ...(action === 'reject' ? { reject_reason: reason.trim() } : {}) })
      const fails = r?.failures?.length ? ` · 실패 ${r.failures.map((f: any) => f.code).join(', ')}` : ''
      setMsg(`${action === 'approve' ? '승인' : action === 'reject' ? '반려' : '되돌리기'} 완료${fails}`)
      setReason('')
      setDetail(await getReviewDetail(pid).catch(() => null))
      load()
    } catch (e: any) {
      setMsg(e?.message || '처리하지 못했어요.')
    } finally { setBusy(false) }
  }

  if (gate === 'checking') return <div className="survey-container"><div className="survey-card">확인 중…</div></div>
  if (gate !== 'ok') {
    const text = gate === 'login' ? '관리자 계정으로 로그인해 주세요.'
      : gate === 'forbidden' ? '이 화면은 관리자만 볼 수 있어요.'
        : '관리자 확인을 지금 할 수 없어요. 잠시 후 다시 시도해 주세요.'
    return (
      <div className="survey-container"><div className="survey-card" data-testid="admin-gate">
        <p style={{ marginBottom: 'var(--space-3)' }}>{text}</p>
        {gate === 'login' && <button className="btn btn-primary" onClick={() => navigate('/login')}>로그인</button>}
        {gate === 'forbidden' && <button className="btn btn-secondary" onClick={() => navigate('/')}>홈으로</button>}
      </div></div>
    )
  }

  const items: any[] = data?.items || []
  const totals = data?.totals || {}
  return (
    <div className="survey-container fade-in">
      <div className="survey-card" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="survey-step-title">관리자 · 제보 검토</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{email} · 대기 {totals.candidate ?? '-'} · 보류 {totals.held ?? '-'} · 자동반영 {totals.auto_applied ?? '-'}</p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          {(['pending', 'auto'] as Tab[]).map((t) => (
            <button key={t} type="button" className={tab === t ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ width: 'auto', padding: 'var(--space-2) var(--space-4)', whiteSpace: 'nowrap' }}
              onClick={() => setTab(t)}>{t === 'pending' ? '검토 대기' : '알레르기 자동반영'}</button>
          ))}
        </div>
        {msg && <p style={{ fontSize: 13, marginTop: 'var(--space-2)' }} data-testid="admin-msg">{msg}</p>}
        <a href={`${MEOKSEON_BASE}/contribution-review.html`} target="_blank" rel="noreferrer"
          style={{ display: 'inline-block', fontSize: 12, marginTop: 'var(--space-2)', color: 'var(--text-muted)' }}>
          값 정정·기준 채우기 등 고급 검토(기존 화면) ↗
        </a>
      </div>

      {items.length === 0 && <div className="survey-card"><p style={{ fontSize: 14 }}>비어 있어요.</p></div>}
      {items.map((it) => (
        <div key={it.product_id} className="survey-card" style={{ marginBottom: 'var(--space-2)' }}>
          <button type="button" onClick={() => toggle(it.product_id)}
            style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
            <div style={{ fontWeight: 700 }}>{it.product_name || '(이름 없음)'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{it.barcode || '-'} · #{it.product_id}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {(it.axes || []).map((a: any) => `${axisKo(a.axis)}(${a.held ? '보류' : statusKo(a.status)})`).join(' · ')}
            </div>
          </button>
          {open === it.product_id && (
            <div style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-2)' }}>
              {!detail && <p style={{ fontSize: 13 }}>불러오는 중…</p>}
              {detail?.axes?.map((a: any) => (
                <div key={a.review_id} style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{axisKo(a.axis)} · {a.held ? '보류' : statusKo(a.status)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>#{a.review_id}</span></div>
                  {describeProposed(a.axis, a.proposed).map((l, i) => (
                    <p key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{l}</p>
                  ))}
                  {a.axis === 'nutrition' && a.basis && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>표기 기준: {a.basis.value ?? '모름(고급 화면에서 채우기)'}</p>}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                    {a.status === 'candidate' && <>
                      <button type="button" className="btn btn-primary" disabled={busy} style={{ width: 'auto', padding: '6px 14px', whiteSpace: 'nowrap' }}
                        onClick={() => act(it.product_id, 'approve', [a.review_id])}>승인</button>
                      <button type="button" className="btn btn-secondary" disabled={busy} style={{ width: 'auto', padding: '6px 14px', whiteSpace: 'nowrap' }}
                        onClick={() => act(it.product_id, 'reject', [a.review_id])}>반려</button>
                    </>}
                    {(a.status === 'auto_applied' || (a.status === 'approved' && a.applied_at)) &&
                      <button type="button" className="btn btn-secondary" disabled={busy} style={{ width: 'auto', padding: '6px 14px', whiteSpace: 'nowrap' }}
                        onClick={() => act(it.product_id, 'undo', [a.review_id])}>되돌리기</button>}
                  </div>
                </div>
              ))}
              {detail?.axes?.some((a: any) => a.status === 'candidate') && (
                <input className="input-field" placeholder="반려 사유(반려할 때 필수)" value={reason}
                  onChange={(e) => setReason(e.target.value)} style={{ width: '100%' }} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
