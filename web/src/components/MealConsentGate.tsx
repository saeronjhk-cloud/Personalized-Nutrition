import { useState, useEffect } from 'react'
import { track } from '../lib/events'
import { Link } from 'react-router-dom'
import { markMealConsent, markMealConsentServer } from '../lib/mealConsent'

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
  const [confirmAge, setConfirmAge] = useState(false) // P0-④ 만 14세 이상
  const canProceed = agreeSensitive && agreeIntl && confirmAge

  useEffect(() => { track('meal_consent_shown') }, [])

  async function handleAccept() {
    track('meal_consent_accepted')
    markMealConsent()  // 로컬 캐시(UX)
    // 서버 기록(권위) — Edge가 분석 전 meal_consent_active로 재검증(P0-③ G2, P0-④ 연령)
    try { await markMealConsentServer(confirmAge) } catch { /* 실패 시 Edge가 차단 → 사용자 재시도 */ }
    onAccept()
  }

  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title">식사 사진 분석 동의</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
          식사 사진 기록은 사진 속 음식을 인식해 칼로리·영양을 추정하고 내 건강 기록에 쌓아드리는 기능입니다.
          이를 위해 촬영·선택한 <strong>식사 사진</strong>과 그로부터 추정된 <strong>음식·칼로리·영양 정보(건강에 관한 정보)</strong>를
          수집·이용하며, 분석을 위해 <strong>음식 영역으로 최소화한 이미지</strong>가 <strong>국외(미국)의 엔진·AI 처리자(OpenAI 등)</strong>에게 전송·처리됩니다.
          회사는 <strong>전체 원본 사진은 전송하지 않고</strong>, 음식 영역만 잘라 저해상도로 축소한 이미지만 전송하며 위치정보 등 부가정보(EXIF)를 제거합니다.
          OpenAI는 요청 처리·오남용 방지를 위해 전송분을 최대 30일간 보관할 수 있으며, API로 전송된 데이터를 모델 학습에 사용하지 않습니다.
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
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.6, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={confirmAge} onChange={(e) => setConfirmAge(e.target.checked)} style={{ marginTop: 3 }} />
          <span>[필수] 저는 <strong>만 14세 이상</strong>입니다. (만 14세 미만은 식사 사진 분석을 이용할 수 없습니다.)</span>
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
