/**
 * 「의견 보내기」 — 베타 패널 전용 피드백 창구 (세션54 · 2026-09-22)
 *
 * 결과 화면(저장 전후 무관)에 붙는다. 종류(음식명 정정 / 버그 / 의견) + 한 줄.
 * job_id 를 함께 보내 «어느 사진에 대한 말인지»를 잇는다. isBetaPanel() 이 아니면 아무것도 안 그린다.
 */
import { useState } from 'react'
import { FEEDBACK_KINDS, isBetaPanel, sendFeedback, type FeedbackKind } from '../lib/betaPanel'

export default function BetaFeedback(props: { jobId?: string | null; foods?: string[]; page?: string }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>('correction')
  const [message, setMessage] = useState('')
  const [foodName, setFoodName] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (!isBetaPanel()) return null

  const meta = FEEDBACK_KINDS.find((k) => k.key === kind)!

  async function submit() {
    setBusy(true); setErr(null)
    const r = await sendFeedback({ kind, message, foodName, jobId: props.jobId, page: props.page })
    setBusy(false)
    if (r.ok) { setDone('보내 주셔서 감사합니다.'); setMessage(''); setFoodName(''); setOpen(false) }
    else setErr(r.error)
  }

  return (
    <div className="survey-card" style={{ marginBottom: 'var(--space-4)', borderColor: 'var(--primary)' }}>
      {!open ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-body-sm)', color: 'var(--text-secondary)' }}>
            {done ?? '결과가 틀렸거나 이상하면 알려 주세요'}
          </span>
          <button type="button" className="btn btn-secondary" style={{ padding: 'var(--space-2) var(--space-4)', whiteSpace: 'nowrap' }} onClick={() => { setOpen(true); setDone(null) }}>
            의견 보내기
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            {FEEDBACK_KINDS.map((k) => (
              <button key={k.key} type="button"
                className={'btn ' + (kind === k.key ? 'btn-primary' : 'btn-secondary')}
                style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-body-sm)' }}
                onClick={() => setKind(k.key)}>
                {k.label}
              </button>
            ))}
          </div>
          {kind === 'correction' && (
            <>
              {props.foods && props.foods.length > 0 && (
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                  앱이 본 것: {props.foods.join(', ')}
                </p>
              )}
              <input value={foodName} onChange={(e) => setFoodName(e.target.value)} maxLength={60}
                placeholder="맞는 음식명 (예: 곰탕)" aria-label="맞는 음식명"
                style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 'var(--font-body)' }} />
            </>
          )}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3}
            placeholder={meta.hint} aria-label="의견 내용"
            style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 'var(--font-body)', resize: 'vertical' }} />
          {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--font-body-sm)', marginBottom: 'var(--space-2)' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOpen(false)} disabled={busy}>취소</button>
            <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={submit} disabled={busy || !message.trim()}>
              {busy ? '보내는 중…' : '보내기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
