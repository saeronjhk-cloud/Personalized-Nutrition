/**
 * 익명 분석 수집 클라이언트
 *
 * - 설문 완료 후 단 한 번, fire-and-forget 방식으로 /api/survey-submit 호출
 * - 실패해도 UI는 영향 받지 않음 (catch 후 무시)
 * - 사용자가 '데이터 수집 안내' 배너에서 '거부' 선택했으면 호출하지 않음
 *   (고지형이라 기본값은 수집이지만, 향후 거부 옵션 추가 시 대비)
 */

import type { SurveyAnswers, RecommendationResult } from '../types'
import { supabase } from "./supabase";

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

function ageGroup(age: number): string {
  if (!age || age < 1) return 'unknown'
  if (age < 20) return '10대'
  if (age < 30) return '20대'
  if (age < 40) return '30대'
  if (age < 50) return '40대'
  if (age < 60) return '50대'
  if (age < 70) return '60대'
  return '70대+'
}

function computeBmi(heightCm?: number, weightKg?: number): number | null {
  if (!heightCm || !weightKg || heightCm < 50) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

function buildLifestyle(answers: SurveyAnswers) {
  return {
    수면: answers.수면,
    스트레스: answers.스트레스,
    운동: answers.운동,
    운동유형: answers.운동유형,
    일조량: answers.일조량,
    식사패턴: answers.식사패턴,
    식이제한: answers.식이제한,
    음주: answers.음주,
    흡연: answers.흡연,
    체중변화: answers.체중변화,
    월경상태: answers.월경상태,
  }
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

    const sessionId = payload.sessionId ?? getOrCreateSessionId()

    try {
      try {
        localStorage.setItem('last_session_id', sessionId)
      } catch {}

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase.from('survey_responses').insert({
          user_id: user.id,
          age: answers.나이 ?? null,
          gender: answers.성별 ?? null,
          height_cm: answers.신장 ?? null,
          weight_kg: answers.체중 ?? null,
          symptoms: answers.증상 ?? [],
          goals: answers.목표 ?? [],
          sleep_pattern: answers.수면 ?? null,
          stress_level: answers.스트레스 ?? null,
          exercise_freq: answers.운동 ?? null,
          diet_pattern: answers.식사패턴 ?? null,
          alcohol_freq: answers.음주 ?? null,
          current_supplements: answers.현재복용영양제 ?? [],
          conditions: answers.기저질환 ?? [],
          family_history: answers.가족력 ?? [],
          persona_id: payload.personaId || null,
        })
        if (error) console.error('[supabase] survey_responses insert failed:', error)
      } else {
        const { error } = await supabase.from('anon_sessions').insert({
          session_id: sessionId,
          device: payload.device ?? null,
          age_group: ageGroup(answers.나이),
          gender: answers.성별 ?? null,
          height_cm: answers.신장 ?? null,
          weight_kg: answers.체중 ?? null,
          bmi: computeBmi(answers.신장, answers.체중),
          symptoms: answers.증상 ?? [],
          goals: answers.목표 ?? [],
          lifestyle: buildLifestyle(answers),
          current_supplements: answers.현재복용영양제 ?? [],
          conditions: answers.기저질환 ?? [],
          family_history: answers.가족력 ?? [],
          recommendations: recommendations ?? null,
          persona_id: payload.personaId || null,
          ip_hash: null,
          ua_hash: null,
        })
        if (error) console.error('[supabase] anon_sessions insert failed:', error)
      }
    } catch (err) {
      console.error('[supabase] sync failed:', err)
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
