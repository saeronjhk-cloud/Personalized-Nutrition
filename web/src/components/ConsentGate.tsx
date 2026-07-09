import { useState } from 'react'
import { Link } from 'react-router-dom'
import { markSensitiveConsent } from '../lib/analytics'

interface Props {
  onAccept: () => void
  onDecline: () => void
}

/**
 * 설문 기반 건강 관련(민감) 정보 수집·이용 opt-in 동의 게이트 (동의 항목 #2).
 * - 설문 시작 전 노출. 기본 미동의(체크박스 unchecked, 사전체크 금지).
 * - 동의해야만 설문 진행 및 저장(analytics opt-in). 거부 시 홈으로(회원가입/타 기능은 유지).
 * - 문구는 개인정보처리방침 v4.7 §3-2 / 이용약관 v4.5 제6조의2와 1:1 정합.
 *   ("각 동의는 하나로 묶지 않으며, 사전 선택 없이 이용자가 직접 선택" — 기능 이용 시 개별 동의)
 */
export default function ConsentGate({ onAccept, onDecline }: Props) {
  // 두 동의 분리: 일반 개인정보 + 건강 민감정보. 둘 다 필수(사전체크 금지).
  const [agreePI, setAgreePI] = useState(false)
  const [agreeSensitive, setAgreeSensitive] = useState(false)
  const canProceed = agreePI && agreeSensitive
  function handleAccept() {
    markSensitiveConsent() // 민감정보 동의 기록(일반 개인정보 동의는 onAccept에서 기록)
    onAccept()
  }
  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title">설문 기반 건강 관련 정보 수집·이용 동의</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
          이 설문은 맞춤 영양(건강기능식품 등) 추천과 생활습관 가이드를 제공하고 본인 기록·변화 추적에 활용하기 위해,
          증상·기저질환·가족력·생활습관·성별·연령·신장·체중·건강 목표 등 설문 입력 정보와 그로부터 산출된 추천 결과를{' '}
          <strong>건강 관련 민감정보</strong>로 취급하여 수집·이용합니다. 로그인한 경우 회원 계정에 저장되어 변화 추적에 사용되며,
          비로그인 시 비회원 임시 세션 식별자를 통해 처리됩니다. 이 정보는 생성일로부터 최대 730일 또는 탈퇴·삭제요청 시까지 보관됩니다.
          자세한 내용은{' '}
          <Link to="/privacy" style={{ color: '#2563eb', textDecoration: 'underline' }}>개인정보처리방침</Link> 및{' '}
          <Link to="/terms" style={{ color: '#2563eb', textDecoration: 'underline' }}>이용약관</Link>을 확인하세요.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>
          가족력은 본인의 건강관리 참고 범위에서만 입력해 주세요. 가족 구성원의 이름·연락처·생년월일 등 식별정보는 입력하지 마세요.
        </p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.6, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreePI} onChange={(e) => setAgreePI(e.target.checked)} style={{ marginTop: 3 }} />
          <span>[필수] <strong>개인정보</strong> 수집·이용에 동의합니다. (성별·연령·신장·체중·생활습관 등 설문 입력 정보 및 추천 결과)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.6, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreeSensitive} onChange={(e) => setAgreeSensitive(e.target.checked)} style={{ marginTop: 3 }} />
          <span>[필수] <strong>민감정보(건강에 관한 정보)</strong> 수집·이용에 동의합니다. (증상·기저질환·가족력·건강 목표) 거부 시 설문 기능 이용이 제한되며, 회원가입 및 다른 기능은 이용할 수 있습니다.</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn btn-primary" disabled={!canProceed} onClick={handleAccept}>
            동의하고 설문 시작
          </button>
          <button type="button" className="btn btn-secondary" onClick={onDecline}>
            동의하지 않음
          </button>
        </div>
      </div>
    </div>
  )
}
