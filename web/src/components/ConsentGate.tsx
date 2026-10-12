import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GATE_TITLE, GATE_BODY_BEFORE_LINKS, GATE_FAMILY_NOTE, GATE_CHECK_PI, GATE_CHECK_SENSITIVE,
  GATE_BTN_ACCEPT, GATE_BTN_DECLINE, RECONSENT_TITLE, RECONSENT_BODY, GATE_SUBMIT_ERROR,
  canSubmitSurveyConsent,
} from '../domain/survey/consent_v2'

interface Props {
  /** first = 처음 · reconsent = 동의문 버전 변경 · anon = 비로그인(메모리 동의, 저장 시 RPC 가 서버 기록) */
  mode?: 'first' | 'reconsent' | 'anon'
  /** 로그인: 서버 기록(give_survey_consent). 실패 시 throw → 오류 표시·진입 안 함(거짓 통과 금지). */
  onAccept: (consent: { pi: boolean; sensitive: boolean }) => void | Promise<void>
  onDecline: () => void
  /** 동의 버튼 라벨 (기본: 동의하고 설문 시작). 목표 카드는 «동의하고 목표 설정» — 동의 범위(건강 목표 포함)는 동일. */
  acceptLabel?: string
}

/**
 * 설문 기반 건강 관련(민감) 정보 수집·이용 opt-in 동의 게이트 (동의 항목 #2) — v2 서버 기록.
 * - 기본 미동의(사전 체크 금지). 필수 2개(일반 개인정보 + 민감정보) 분리.
 * - 문구 = IP/설문동의_고지문안_정본_v1_20261012.md §1 (domain/survey/consent_v2.ts 복사본, notice survey_v1)
 * - localStorage 동의 키 기록 0 — 서버(SQL 163)가 권위. 평가 IP/integration/survey_consent_v2_eval_v1.md A01~A04
 */
export default function ConsentGate({ mode = 'first', onAccept, onDecline, acceptLabel = GATE_BTN_ACCEPT }: Props) {
  const [agreePI, setAgreePI] = useState(false)
  const [agreeSensitive, setAgreeSensitive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canProceed = canSubmitSurveyConsent(agreePI, agreeSensitive) && !busy

  async function handleAccept() {
    if (!canSubmitSurveyConsent(agreePI, agreeSensitive) || busy) return
    setBusy(true); setError(null)
    try {
      await onAccept({ pi: agreePI, sensitive: agreeSensitive })
    } catch {
      setError(GATE_SUBMIT_ERROR)
      setBusy(false)
    }
  }

  const label = { display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: 14, lineHeight: 1.6, cursor: 'pointer' } as const
  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        {mode === 'reconsent' && (
          <div data-testid="survey-reconsent" style={{ background: 'var(--surface-2, rgba(142,202,230,0.12))', borderRadius: 10, padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 'var(--space-1)' }}>{RECONSENT_TITLE}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>{RECONSENT_BODY}</p>
          </div>
        )}
        <h2 className="survey-step-title">{GATE_TITLE}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
          {GATE_BODY_BEFORE_LINKS}{' '}
          <Link to="/privacy" style={{ color: '#2563eb', textDecoration: 'underline' }}>개인정보처리방침</Link> 및{' '}
          <Link to="/terms" style={{ color: '#2563eb', textDecoration: 'underline' }}>이용약관</Link>을 확인하세요.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
          {GATE_FAMILY_NOTE}
        </p>
        <label style={{ ...label, marginBottom: 'var(--space-3)' }}>
          <input type="checkbox" data-testid="survey-consent-pi" checked={agreePI} onChange={(e) => setAgreePI(e.target.checked)} style={{ marginTop: 'var(--space-1)' }} />
          <span>{GATE_CHECK_PI}</span>
        </label>
        <label style={{ ...label, marginBottom: 'var(--space-5)' }}>
          <input type="checkbox" data-testid="survey-consent-sensitive" checked={agreeSensitive} onChange={(e) => setAgreeSensitive(e.target.checked)} style={{ marginTop: 'var(--space-1)' }} />
          <span>{GATE_CHECK_SENSITIVE}</span>
        </label>
        {error && <p role="alert" data-testid="survey-consent-error" style={{ color: 'var(--danger, #b91c1c)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-primary" data-testid="survey-consent-accept" disabled={!canProceed} onClick={handleAccept}>
            {busy ? '저장 중…' : acceptLabel}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onDecline}>
            {GATE_BTN_DECLINE}
          </button>
        </div>
      </div>
    </div>
  )
}
