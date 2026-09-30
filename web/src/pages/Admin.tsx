/**
 * ★ 세션72d — 앱 안 관리자 화면 (/admin · 제이 결정 2026-09-30)
 *   · 메뉴에 없다. 관리자 계정(ADMIN_EMAILS)만 서버가 통과시킨다 — 일반 사용자가 주소를 쳐도 403 화면.
 *   · 할 수 있는 일: 검토 대기 목록 → 제품 펼치기(제보 값) → 축별 승인/반려 · 자동반영 목록 → 되돌리기.
 *   · 값 정정·기준 채우기 같은 고급 작업은 기존 화면(contribution-review.html) 링크로 보낸다(두 벌 금지).
 * ★ 세션72f — 제보 사진(축소본)을 왼쪽에, 축별 «정정 후 승인» 편집기를 오른쪽에(제이 결정 2026-09-30).
 *   정정은 서버 override(판정 테이블)에 남고 사용자 원본은 그대로다. 승인은 정정을 얹어 반영한다.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  adminWhoami, listReviewQueue, getReviewDetail, verifyReviews, gateFromError,
  describeProposed, axisKo, statusKo, MEOKSEON_BASE, type AdminGate,
  listPhotos, fetchPhotoUrl, overrideReview, initialEdit, buildOverrideValues,
  ALLERGENS_19, NUTRIENT_KEYS, type AdminPhoto, type AllergenMark,
} from '../lib/meokseonAdmin'

const NUT_LABEL: Record<string, string> = {
  calories: '열량(kcal)', sodium: '나트륨(mg)', total_carbs: '탄수화물(g)', total_sugars: '당류(g)', total_fat: '지방(g)',
  saturated_fat: '포화지방(g)', trans_fat: '트랜스지방(g)', cholesterol: '콜레스테롤(mg)', protein: '단백질(g)', dietary_fiber: '식이섬유(g)',
}
const MARK_NEXT: Record<AllergenMark, AllergenMark> = { none: 'contains', contains: 'may_contain', may_contain: 'none' }
const MARK_STYLE: Record<AllergenMark, { bg: string; fg: string; label: string }> = {
  none: { bg: 'var(--bg-secondary, #f3f4f6)', fg: 'var(--text-muted)', label: '' },
  contains: { bg: '#fde2e2', fg: '#b91c1c', label: '함유' },
  may_contain: { bg: '#fef3c7', fg: '#92400e', label: '혼입' },
}
const smallBtn = { width: 'auto', padding: '6px 14px', whiteSpace: 'nowrap' as const }

/** 제보 사진 — 관리자 토큰으로 받아 blob URL 로 띄운다. 누르면 새 탭에서 원래 크기. */
function PhotoPanel({ productId }: { productId: number }) {
  const [photos, setPhotos] = useState<AdminPhoto[] | null>(null)
  const [urls, setUrls] = useState<Record<number, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const made = useRef<string[]>([])
  useEffect(() => {
    let alive = true
    listPhotos(productId).then(async (ps) => {
      if (!alive) return
      setPhotos(ps)
      for (const p of ps) {
        try {
          const u = await fetchPhotoUrl(p.photo_id)
          made.current.push(u)
          if (alive) setUrls((m) => ({ ...m, [p.photo_id]: u }))
        } catch (e: any) { if (alive) setErr(e?.message || '사진을 불러오지 못했어요.') }
      }
    }).catch((e) => { if (alive) setErr(e?.message || '사진 목록을 불러오지 못했어요.') })
    return () => { alive = false; made.current.forEach((u) => URL.revokeObjectURL(u)); made.current = [] }
  }, [productId])
  if (photos === null && !err) return <p style={{ fontSize: 13 }}>사진 불러오는 중…</p>
  if (err) return <p style={{ fontSize: 13, color: 'var(--danger, #b91c1c)' }}>{err}</p>
  if (!photos?.length) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }} data-testid="admin-no-photo">사진 없음 — 사진 보관이 켜지기 전의 제보이거나, 앱이 축소본을 만들지 못했어요.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {photos.map((p) => (
        <figure key={p.photo_id} style={{ margin: 0 }}>
          <figcaption style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            {p.kind === 'label' ? '라벨(원재료·알레르기)' : '영양성분표'} · {new Date(p.created_at).toLocaleString('ko-KR')}
          </figcaption>
          {urls[p.photo_id]
            ? <a href={urls[p.photo_id]} target="_blank" rel="noreferrer"><img src={urls[p.photo_id]} alt={p.kind}
                style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-light)' }} /></a>
            : <div style={{ fontSize: 12 }}>불러오는 중…</div>}
        </figure>
      ))}
    </div>
  )
}

/** 한 축의 정정 편집기 + 승인/반려. 정정이 있으면 override 를 먼저 저장하고 승인한다. */
function AxisEditor({ a, busy, onApprove, onReject }: {
  a: any; busy: boolean
  onApprove: (values: Record<string, any> | null, note: string) => void
  onReject: () => void
}) {
  const editable = a.axis === 'allergens' || a.axis === 'ingredients' || a.axis === 'nutrition'
  const [initial] = useState(() => initialEdit(a.axis, a))
  const [edit, setEdit] = useState<any>(() => initialEdit(a.axis, a))
  const [note, setNote] = useState('라벨 사진 확인')
  const [err, setErr] = useState<string | null>(null)
  let changed = false
  try { changed = editable && buildOverrideValues(a.axis, edit, initial) !== null } catch { changed = true }
  function approve() {
    setErr(null)
    try {
      const v = editable ? buildOverrideValues(a.axis, edit, initial) : null
      if (v && !note.trim()) { setErr('무엇을 보고 고쳤는지 적어 주세요.'); return }
      onApprove(v, note.trim())
    } catch (e: any) { setErr(e?.message || '값을 확인해 주세요.') }
  }
  return (
    <div style={{ marginTop: 'var(--space-1)' }}>
      {a.axis === 'allergens' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-testid="allergen-editor">
          {ALLERGENS_19.map((n) => {
            const m: AllergenMark = edit[n]; const st = MARK_STYLE[m]
            return (
              <button key={n} type="button" disabled={busy}
                onClick={() => setEdit((e: any) => ({ ...e, [n]: MARK_NEXT[e[n] as AllergenMark] }))}
                style={{ border: '1px solid var(--border-light)', borderRadius: 999, padding: '4px 10px', fontSize: 12,
                  background: st.bg, color: st.fg, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {n}{st.label ? ` · ${st.label}` : ''}
              </button>
            )
          })}
          <p style={{ width: '100%', fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>누를 때마다 없음 → 함유 → 혼입 → 없음</p>
        </div>
      )}
      {a.axis === 'ingredients' && (
        <textarea className="input-field" rows={4} value={edit} disabled={busy}
          onChange={(e) => setEdit(e.target.value)} style={{ width: '100%', fontSize: 13 }}
          placeholder="원재료명을 라벨 그대로 적어 주세요(쉼표로 구분)" />
      )}
      {a.axis === 'additives' && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>첨가물은 원재료에서 다시 검출합니다 — 원재료를 정정하면 여기에도 적용돼요.</p>
      )}
      {a.axis === 'nutrition' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
          {NUTRIENT_KEYS.map((k) => (
            <label key={k} style={{ fontSize: 12 }}>{NUT_LABEL[k]}
              <input className="input-field" inputMode="decimal" value={edit[k]} disabled={busy}
                onChange={(e) => setEdit((x: any) => ({ ...x, [k]: e.target.value }))} style={{ width: '100%', padding: '4px 8px' }} />
            </label>
          ))}
        </div>
      )}
      {changed && (
        <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} disabled={busy}
          placeholder="정정 근거(예: 라벨 사진 확인 · OCR 이 우유를 놓침)" style={{ width: '100%', marginTop: 6, fontSize: 13 }} />
      )}
      {err && <p style={{ fontSize: 12, color: 'var(--danger, #b91c1c)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" disabled={busy} style={smallBtn} onClick={approve}>
          {changed ? '정정해서 승인' : '승인'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} style={smallBtn} onClick={onReject}>반려</button>
      </div>
    </div>
  )
}

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

  async function act(pid: number, action: 'approve' | 'reject' | 'undo', reviewIds: number[],
    ov?: { values: Record<string, any>; note: string } | null) {
    if (action === 'reject' && !reason.trim()) { setMsg('반려 사유를 먼저 적어 주세요.'); return }
    setBusy(true); setMsg(null)
    try {
      // ★ 세션72f — 정정이 있으면 판정(override)을 먼저 남기고 승인한다. 승인 경로가 정정을 얹는다.
      if (action === 'approve' && ov) await overrideReview(reviewIds[0], ov.values, ov.note)
      const r = await verifyReviews(pid, { action, review_ids: reviewIds, ...(action === 'reject' ? { reject_reason: reason.trim() } : {}) })
      const fails = r?.failures?.length ? ` · 실패 ${r.failures.map((f: any) => f.code).join(', ')}` : ''
      setMsg(`${action === 'approve' ? (ov ? '정정 후 승인' : '승인') : action === 'reject' ? '반려' : '되돌리기'} 완료${fails}`)
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
    <div className="survey-container fade-in" style={{ maxWidth: 1120 }}>
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
            <div style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-2)',
              display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 320px', minWidth: 0, position: 'sticky', top: 72 }}>
                <PhotoPanel productId={it.product_id} />
              </div>
              <div style={{ flex: '1 1 380px', minWidth: 0 }}>
              {!detail && <p style={{ fontSize: 13 }}>불러오는 중…</p>}
              {detail?.axes?.map((a: any) => (
                <div key={a.review_id} style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{axisKo(a.axis)} · {a.held ? '보류' : statusKo(a.status)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>#{a.review_id}</span></div>
                  {describeProposed(a.axis, a.proposed).map((l, i) => (
                    <p key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>제보: {l}</p>
                  ))}
                  {a.override && <p style={{ fontSize: 12, color: '#1d4ed8' }}>관리자 정정 있음 · {a.override.by ?? ''} · {a.override.note ?? ''}</p>}
                  {a.axis === 'nutrition' && a.basis && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>표기 기준: {a.basis.value ?? '모름(고급 화면에서 채우기)'}</p>}
                  {a.status === 'candidate' && (
                    <AxisEditor a={a} busy={busy}
                      onApprove={(values, note) => act(it.product_id, 'approve', [a.review_id], values ? { values, note } : null)}
                      onReject={() => act(it.product_id, 'reject', [a.review_id])} />
                  )}
                  {(a.status === 'auto_applied' || (a.status === 'approved' && a.applied_at)) && (
                    <div style={{ marginTop: 'var(--space-1)' }}>
                      <button type="button" className="btn btn-secondary" disabled={busy} style={smallBtn}
                        onClick={() => act(it.product_id, 'undo', [a.review_id])}>되돌리기</button>
                    </div>
                  )}
                </div>
              ))}
              {detail?.axes?.some((a: any) => a.status === 'candidate') && (
                <input className="input-field" placeholder="반려 사유(반려할 때 필수)" value={reason}
                  onChange={(e) => setReason(e.target.value)} style={{ width: '100%' }} />
              )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
