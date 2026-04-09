/**
 * 데이터 수집 고지 배너
 *
 * 화면 하단에 얇게 떠 있으며, "확인"을 누르면 localStorage에 기록되어
 * 다시 나타나지 않는다. 사용자 경험을 방해하지 않는 가벼운 고지형.
 * (PIPA 옵트인 방식이 아니라 '알림 + 승인' 방식이라 서비스 이용은 차단하지 않는다.)
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { markConsentAcknowledged } from '../lib/analytics'

const NOTICE_KEY = 'sf_data_notice_dismissed_v1'

export default function DataCollectionNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(NOTICE_KEY)
      if (!dismissed) {
        // 페이지 로드 후 잠깐 뒤에 표시 (초기 렌더 방해 방지)
        const t = setTimeout(() => setVisible(true), 800)
        return () => clearTimeout(t)
      }
    } catch {
      // 무시
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(NOTICE_KEY, '1')
      markConsentAcknowledged()
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 9999,
        background: 'rgba(26, 34, 56, 0.96)',
        color: '#fff',
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        fontSize: 13,
        lineHeight: 1.5,
        maxWidth: 720,
        margin: '0 auto',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        🔒 서비스 품질 개선을 위해 설문 응답과 추천 결과를 <strong>익명으로</strong> 수집합니다. 이름·이메일·연락처는 수집하지 않습니다.{' '}
        <Link
          to="/privacy"
          style={{ color: '#8ecae6', textDecoration: 'underline' }}
          onClick={() => setTimeout(dismiss, 100)}
        >
          자세히 보기
        </Link>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: '#8ecae6',
          color: '#1a2238',
          border: 'none',
          borderRadius: 8,
          padding: '8px 18px',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        확인
      </button>
    </div>
  )
}
