import { useState } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  onAccept: () => void
  onDecline: () => void
}

/**
 * 건강검진 해석 기능 — 건강검진 민감정보 수집·이용 opt-in 동의 게이트 (동의 항목 #3).
 * - 검진 수치 입력(BiomarkerForm) 진입 전 노출. 기본 미동의(체크박스 unchecked, 사전체크 금지).
 * - 설문 동의(#2)와 별개의 독립 동의(하나로 묶지 않음 — 별도동의 요건).
 * - 문구는 개인정보처리방침 v4.7 §3-3 / 이용약관 v4.5 제6조의2와 1:1 정합.
 * - 이 게이트는 CHECKUP_ENABLED(플래그)가 켜진 경우에만 실제로 노출된다.
 * - 주의: 검진 수치 입력은 수동 입력이 기본이며, 결과지 OCR(및 OCR 국외이전, 동의 #4·#6)은
 *   현재 이 저장소에 기능 표면이 없다. OCR 기능을 추가할 때 별도 opt-in 동의 게이트를 별건으로 구현해야 한다.
 */
export default function CheckupConsentGate({ onAccept, onDecline }: Props) {
  const [checked, setChecked] = useState(false)
  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title">건강검진 민감정보 수집·이용 동의</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
          건강검진 해석 기능은 이용자가 직접 입력한 검진 수치(혈압·혈당·지질·간기능·신장기능·체격 등)와
          성별·연령대·입력일시·적용 기준표 버전·해석 결과를 <strong>건강 관련 민감정보</strong>로 취급하여,
          회사가 명시한 판정기준표에 대입한 참고 범위 안내·전문가 상담 권고·본인 기록 관리 목적으로 수집·이용합니다.
          이 정보는 입력일로부터 최대 730일 또는 탈퇴·삭제요청 시까지 보관됩니다.
          <strong> 본 기능은 의학적 진단·치료·처방이 아니며 의료기기가 아닙니다.</strong> 자세한 내용은{' '}
          <Link to="/privacy" style={{ color: '#2563eb', textDecoration: 'underline' }}>개인정보처리방침</Link> 및{' '}
          <Link to="/terms" style={{ color: '#2563eb', textDecoration: 'underline' }}>이용약관</Link>을 확인하세요.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>
          타인의 건강검진 결과지를 본인 동의 없이 입력하지 마세요. 검진 수치는 본인의 결과지를 기준으로 입력해 주세요.
        </p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.6, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 3 }} />
          <span>[검진 해석 기능 이용 시 필수] 건강검진 민감정보의 수집·이용에 동의합니다. 거부 시 검진 해석 기능 이용이 제한되며, 회원가입 및 다른 기능은 이용할 수 있습니다.</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn btn-primary" disabled={!checked} onClick={onAccept}>
            동의하고 검진 입력 시작
          </button>
          <button type="button" className="btn btn-secondary" onClick={onDecline}>
            동의하지 않음
          </button>
        </div>
      </div>
    </div>
  )
}
