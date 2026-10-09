import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GATE_TITLE, GATE_CORE_INTRO, GATE_CORE_BULLETS, GATE_CHECK_CORE, GATE_CHECK_AGE,
  GATE_COMBINE_BULLETS, GATE_CHECK_COMBINE, GATE_SMALL_PRINT, GATE_BTN_ACCEPT, GATE_BTN_DECLINE,
  RECONSENT_TITLE, RECONSENT_BODY, GATE_SUBMIT_ERROR, canSubmitConsent,
} from '../domain/checkup/consent_v2'

interface Props {
  mode: 'first' | 'reconsent'
  /** 서버 기록. 실패 시 throw → 게이트가 오류 표시하고 진입하지 않음(A04). */
  onAccept: (consent: { core: boolean; age14: boolean; combine: boolean }) => Promise<void>
  onDecline: () => void
}

/**
 * 검진 동의 v2 게이트 — 필수(민감정보) + 필수(만14세) + 선택(결합) 3체크, 사전 체크 금지.
 * 문구 = IP/검진동의_고지문안_정본_v2_20261007.md §1·§5 (domain/checkup/consent_v2.ts 복사본)
 * 서버 기록 = SQL 161 give_checkup_consent. 평가 IP/integration/checkup_consent_v2_eval_v1.md A01~A05
 */
export default function CheckupConsentGate({ mode, onAccept, onDecline }: Props) {
  const [core, setCore] = useState(false)
  const [age14, setAge14] = useState(false)
  const [combine, setCombine] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const body = { color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 } as const
  const label = { display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: 14, lineHeight: 1.6, marginBottom: 'var(--space-3)', cursor: 'pointer' } as const

  async function submit() {
    if (!canSubmitConsent(core, age14) || busy) return
    setBusy(true); setError(null)
    try {
      await onAccept({ core, age14, combine })
    } catch {
      setError(GATE_SUBMIT_ERROR)
      setBusy(false)
    }
  }

  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        {mode === 'reconsent' && (
          <div data-testid="checkup-reconsent" style={{ background: 'var(--surface-2, rgba(142,202,230,0.12))', borderRadius: 10, padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 'var(--space-1)' }}>{RECONSENT_TITLE}</p>
            <p style={{ ...body, fontSize: 13 }}>{RECONSENT_BODY}</p>
          </div>
        )}
        <h2 className="survey-step-title">{GATE_TITLE}</h2>

        <p style={{ ...body, marginBottom: 'var(--space-2)' }}>{GATE_CORE_INTRO}</p>
        <ul style={{ ...body, paddingLeft: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
          {GATE_CORE_BULLETS.map((b) => <li key={b}>{b}</li>)}
        </ul>
        <label style={label}>
          <input type="checkbox" data-testid="checkup-consent-core" checked={core} onChange={(e) => setCore(e.target.checked)} style={{ marginTop: 'var(--space-1)' }} />
          <span><strong>{GATE_CHECK_CORE}</strong></span>
        </label>
        <label style={{ ...label, marginBottom: 'var(--space-5)' }}>
          <input type="checkbox" data-testid="checkup-consent-age" checked={age14} onChange={(e) => setAge14(e.target.checked)} style={{ marginTop: 'var(--space-1)' }} />
          <span><strong>{GATE_CHECK_AGE}</strong></span>
        </label>

        <ul style={{ ...body, paddingLeft: 'var(--space-5)', marginBottom: 'var(--space-3)' }}>
          {GATE_COMBINE_BULLETS.map((b) => <li key={b}>{b}</li>)}
        </ul>
        <label style={{ ...label, marginBottom: 'var(--space-4)' }}>
          <input type="checkbox" data-testid="checkup-consent-combine" checked={combine} onChange={(e) => setCombine(e.target.checked)} style={{ marginTop: 'var(--space-1)' }} />
          <span><strong>{GATE_CHECK_COMBINE}</strong></span>
        </label>

        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
          {GATE_SMALL_PRINT}{' '}
          <Link to="/privacy" style={{ color: '#2563eb', textDecoration: 'underline' }}>개인정보처리방침</Link> ·{' '}
          <Link to="/terms" style={{ color: '#2563eb', textDecoration: 'underline' }}>이용약관</Link>
        </p>

        {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-primary" data-testid="checkup-consent-accept" disabled={!canSubmitConsent(core, age14) || busy} onClick={submit}>
            {GATE_BTN_ACCEPT}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onDecline}>
            {GATE_BTN_DECLINE}
          </button>
        </div>
      </div>
    </div>
  )
}
