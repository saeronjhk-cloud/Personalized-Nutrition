import { useState, useEffect } from 'react'
import { track } from '../lib/events'
import { Link } from 'react-router-dom'
import { markMealConsent } from '../lib/mealConsent'

interface Props {
  onAccept: () => void
  onDecline: () => void
}

/**
 * 식사 사진 기록 진입 전 강제되는 출시 게이트 (동의 항목: 식사 사진 민감정보 + 국외이전).
 * - 촬영/갤러리 노출 전에 표시. 기본 미동의(사전체크 금지). 두 동의 모두 필수.
 * - 거부 시 촬영 미진입(다른 기능은 유지). 문구는 개인정보처리방침 '민감정보' 및 '국외이전' 조항과 1:1 정합.
 */
export default function MealConsentGate({ onAccept, onDecline }: Props) {
  const [agreeSensitive, setAgreeSensitive] = useState(false)
  const [agreeIntl, setAgreeIntl] = useState(false)
  const canProceed = agreeSensitive && agreeIntl

  useEffect(() => { track('meal_consent_shown') }, [])

  function handleAccept() {
    track('meal_consent_accepted')
    markMealConsent()
    onAccept()
  }

  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title">식사 사진 분석 동의</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
          식사 사진 기록은 사진 속 음식을 인식해 칼로리·영양을 추정하고 내 건강 기록에 쌓아드리는 기능입니다.
          이를 위해 촬영·선택한 <strong>식사 사진</strong>과 그로부터 추정된 <strong>음식·칼로리·영양 정보(건강에 관한 정보)</strong>를
          수집·이용하며, 분석을 위해 사진(또는 음식 영역)이 <strong>국외(미국)의 엔진·AI 처리자</strong>에게 전송·처리될 수 있습니다.
          회사는 자체 엔진에서 우선 처리하고, 자동 식별이 어려운 경우에만 음식 영역으로 한정한 이미지를 AI 처리자에게 전송하며 원본 사진은 전송하지 않습니다.
          분석 결과는 추정치로 진단이 아닌 생활관리 참고용이며, 저장한 기록은 탈퇴·삭제요청 시까지 보관됩니다.
          자세한 내용은{' '}
          <Link to="/privacy" style={{ color: '#2563eb', textDecoration: 'underline' }}>개인정보처리방침</Link> 및{' '}
          <Link to="/terms" style={{ color: '#2563eb', textDecoration: 'underline' }}>이용약관</Link>을 확인하세요.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>
          사진에 얼굴·타인·주소 등 식별정보가 담기지 않도록 음식 위주로 촬영해 주세요.
        </p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.6, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreeSensitive} onChange={(e) => setAgreeSensitive(e.target.checked)} style={{ marginTop: 3 }} />
          <span>[필수] <strong>민감정보(건강에 관한 정보)</strong> 수집·이용에 동의합니다. (식사 사진 및 그로부터 추정된 음식·칼로리·영양 정보)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.6, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreeIntl} onChange={(e) => setAgreeIntl(e.target.checked)} style={{ marginTop: 3 }} />
          <span>[필수] <strong>개인정보 국외이전</strong>에 동의합니다. (이전받는 자: Railway·OpenAI 등, 국가: 미국 / 항목: 식사 사진·음식 영역 이미지 / 목적: 음식·영양 분석) 거부 시 식사 사진 분석 이용이 제한되며, 다른 기능은 이용할 수 있습니다.</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn btn-primary" disabled={!canProceed} onClick={handleAccept}>
            동의하고 시작
          </button>
          <button type="button" className="btn btn-secondary" onClick={onDecline}>
            동의하지 않음
          </button>
        </div>
      </div>
    </div>
  )
}
