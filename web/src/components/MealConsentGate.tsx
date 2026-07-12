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
        <div style={{ background: 'rgba(142, 202, 230, 0.10)', border: '1px solid rgba(142, 202, 230, 0.30)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 12.5, lineHeight: 1.7, color: 'var(--text)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>동의 전 안내 (법정 고지사항)</div>
          <div style={{ marginBottom: 8 }}>
            <strong>[민감정보(건강에 관한 정보)]</strong><br />
            · 수집·이용 목적: 식사 사진 분석, 음식·섭취량·열량·영양소 추정, 식사기록 및 개인화된 식생활 안내 제공<br />
            · 민감정보 항목: 식사 사진을 분석하여 생성·추정되는 음식 종류·섭취량·열량·영양소 정보 및 이 정보와 다른 건강 관련 정보의 결합으로 생성되는 식생활·건강 관련 정보<br />
            · 보유기간: 해당 기록을 삭제하거나 동의를 철회하거나 회원 탈퇴할 때까지(법령상 보존이 필요한 경우 해당 기간까지 분리 보관)<br />
            · 거부권·효과: 동의를 거부할 수 있으며, 거부 시 식사 사진 분석 기능은 이용할 수 없으나 계정 및 다른 서비스는 계속 이용할 수 있습니다.
          </div>
          <div>
            <strong>[개인정보 국외이전]</strong> 이전받는 자 · 국가 · 항목 · 목적 · 보유기간 · 연락처:<br />
            · Supabase, Inc. (미국) — 원본 식사 사진 및 분석 결과 저장 / 데이터 저장·회원 기능 / 탈퇴·철회 시까지 / privacy@supabase.com<br />
            · Railway Corp. (미국) — 분석 요청 이미지·최소 메타데이터 / 무상태 분석 연산(회사 DB 미저장) / 요청 처리 기간 / privacy@railway.app<br />
            · OpenAI OpCo, LLC (미국) — 음식 영역 크롭·저해상도 이미지(조건부) / 음식 인식 AI 추론 / 최대 30일 / privacy@openai.com<br />
            · 이전 시기·방법: 이용자가 식사 사진 분석을 요청하는 시점에 암호화된 통신망(HTTPS)으로 전송<br />
            · 거부 방법·절차·효과: 아래 '동의하지 않음'을 선택하거나 [설정 &gt; 식사 사진 분석 동의 철회]에서 거부·철회할 수 있으며, 거부 시 식사 사진 분석 기능은 이용할 수 없으나 계정 및 다른 서비스는 계속 이용할 수 있습니다<br />
            자세한 내용은{' '}<Link to="/privacy" style={{ color: '#2563eb', textDecoration: 'underline' }}>개인정보처리방침 제4조</Link>를 확인하세요.
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.6, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreeSensitive} onChange={(e) => setAgreeSensitive(e.target.checked)} style={{ marginTop: 3 }} />
          <span>[필수] 위에 안내된 목적·항목·보유기간·거부효과를 확인하였으며, <strong>민감정보(건강에 관한 정보)</strong> 수집·이용에 동의합니다. (식사 사진 및 그로부터 추정된 음식·칼로리·영양 정보)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.6, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreeIntl} onChange={(e) => setAgreeIntl(e.target.checked)} style={{ marginTop: 3 }} />
          <span>[필수] 위에 안내된 <strong>Supabase, Railway 및 OpenAI(미국)로의 개인정보 국외이전</strong>에 동의합니다. 거부 시 식사 사진 분석 이용이 제한되며, 계정 및 다른 기능은 계속 이용할 수 있습니다.</span>
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
