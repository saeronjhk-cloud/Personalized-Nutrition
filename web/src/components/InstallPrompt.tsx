import { useState, useEffect } from 'react'

/**
 * PWA 설치 안내 배너
 * - Android: beforeinstallprompt 이벤트 사용 (Chrome 자체 설치 프롬프트)
 * - iOS Safari: "홈 화면에 추가" 수동 안내
 * - 이미 설치된 상태(standalone)이면 표시 안 함
 * - 닫으면 7일간 재표시 안 함
 */
export default function InstallPrompt() {
  const [showIOS, setShowIOS] = useState(false)
  const [showAndroid, setShowAndroid] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // 이미 PWA로 실행 중이면 표시 안 함
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) return

    // 닫기 후 7일간 재표시 방지
    const dismissed = localStorage.getItem('pwa_install_dismissed')
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return
    }

    // iOS Safari 감지
    const ua = window.navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua)

    if (isIOS && isSafari) {
      // 페이지 로드 후 2초 뒤에 표시
      const timer = setTimeout(() => setShowIOS(true), 2000)
      return () => clearTimeout(timer)
    }

    // Android / Chrome: beforeinstallprompt 이벤트 리스닝
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShowAndroid(true), 2000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setShowIOS(false)
    setShowAndroid(false)
    localStorage.setItem('pwa_install_dismissed', String(Date.now()))
  }

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      setShowAndroid(false)
    }
    setDeferredPrompt(null)
  }

  if (!showIOS && !showAndroid) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      padding: '0 16px 16px',
      animation: 'slideUp 0.3s ease-out',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '20px',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        maxWidth: 420,
        margin: '0 auto',
        position: 'relative',
      }}>
        {/* 닫기 버튼 */}
        <button
          onClick={dismiss}
          aria-label="닫기"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            fontSize: 20,
            color: '#999',
            cursor: 'pointer',
            padding: 4,
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        {showIOS && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2d5a27', marginBottom: 10 }}>
              앱처럼 사용하기
            </div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
              <strong>홈 화면에 추가</strong>하면 앱처럼 빠르게 실행할 수 있어요!
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              fontSize: 13,
              color: '#666',
              background: '#f8f8f8',
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <span>1. 하단의</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                background: '#007AFF',
                borderRadius: 6,
                color: '#fff',
                fontSize: 18,
              }}>
                &#x2191;
              </span>
              <span>공유 버튼 탭</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 6,
              fontSize: 13,
              color: '#666',
              background: '#f8f8f8',
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <span>2.</span>
              <span style={{ fontWeight: 600 }}>홈 화면에 추가</span>
              <span>선택</span>
            </div>
          </>
        )}

        {showAndroid && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2d5a27', marginBottom: 10 }}>
              앱 설치하기
            </div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 14 }}>
              홈 화면에 설치하면 더 빠르게 이용할 수 있어요!
            </div>
            <button
              onClick={handleAndroidInstall}
              style={{
                width: '100%',
                padding: '12px',
                background: '#2d5a27',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              설치하기
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
