/**
 * 익명 분석 수집 클라이언트
 *
 * - 설문 완료 후 단 한 번, fire-and-forget 방식으로 /api/survey-submit 호출
 * - 실패해도 UI는 영향 받지 않음 (catch 후 무시)
 * - 사용자가 '데이터 수집 안내' 배너에서 '거부' 선택했으면 호출하지 않음
 *   (고지형이라 기본값은 수집이지만, 향후 거부 옵션 추가 시 대비)
 */

import type { SurveyAnswers, RecommendationResult } from '../types'

const SESSION_KEY = 'sf_session_id'
const CONSENT_KEY = 'sf_data_consent'   // 'accepted' | 'declined' | null

export function getOrCreateSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? `anon-${(crypto as any).randomUUID()}`
          : `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return `anon-${Date.now().toString(36)}`
  }
}

export function hasDeclinedCollection(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'declined'
  } catch {
    return false
  }
}

export function markConsentAcknowledged(): void {
  try {
    localStorage.setItem(CONSENT_KEY, 'accepted')
  } catch {
    // 무시
  }
}

function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile'
  return 'desktop'
}

/**
 * 설문 완료 시점에 호출. 실패해도 throw하지 않음.
 */
export async function submitSurveyAnalytics(
  answers: SurveyAnswers,
  result: RecommendationResult | null,
): Promise<void> {
  if (!result) return
  if (hasDeclinedCollection()) return

  try {
    const recommendations = (result.recommendations || []).map((s: any) => ({
      rank: s.rank,
      id: s.id,
      name: s.name,
      score: s.score,
    }))

    const payload = {
      sessionId: getOrCreateSessionId(),
      answers,
      recommendations,
      personaId: result.persona?.id || '',
      device: detectDevice(),
    }

    // 브라우저 언로드에도 안전한 sendBeacon 우선 시도
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      const ok = (navigator as any).sendBeacon('/api/survey-submit', blob)
      if (ok) return
    }

    // fallback
    await fetch('/api/survey-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // fire-and-forget: 어떤 에러도 UI에 영향 주지 않음
  }
}
