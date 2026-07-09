/**
 * 익명 분석 수집 클라이언트
 *
 * - 설문 완료 후 단 한 번(opt-in 동의 시), Supabase에 설문 응답/익명 세션 저장
 * - 실패해도 UI는 영향 받지 않음 (catch 후 무시)
 * - opt-in 동의(sf_data_consent = accepted) 없으면 저장하지 않음
 * - [컴플라이언스] 외부 Google Sheets 전송 경로는 제거됨(민감정보 이중보관·미고지 수탁자 P0). 통계는 Supabase 익명 집계로 대체(작업지시서 58).
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

// opt-in: 명시적으로 'accepted'인 경우에만 수집/저장한다(기본 미수집).
export function hasConsentedCollection(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted'
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

// --- 설문 기반 민감정보(건강 관련) 수집·이용 별도 동의 ---
// 일반 개인정보 동의(CONSENT_KEY)와 분리된 독립 동의. 설문은 건강 민감정보를 포함하므로,
// 설문 진행 전 두 동의(개인정보 + 민감정보)를 각각 명시적으로 받는다(보호법상 별도 동의, 처리방침 §1 민감정보).
const SENSITIVE_CONSENT_KEY = 'sf_sensitive_consent' // 'accepted' | null

export function hasConsentedSensitive(): boolean {
  try {
    return localStorage.getItem(SENSITIVE_CONSENT_KEY) === 'accepted'
  } catch {
    return false
  }
}

export function markSensitiveConsent(): void {
  try {
    localStorage.setItem(SENSITIVE_CONSENT_KEY, 'accepted')
  } catch {
    // 무시
  }
}

// --- 검진(건강검진 해석) 민감정보 수집·이용 동의 (동의 항목 #3) ---
// 설문 동의(#2)와 별개의 독립 동의. 처리방침 v4.7 §3-3 / 약관 §6조의2와 1:1.
// CHECKUP_ENABLED 플래그가 켜졌을 때만 실제로 사용된다(검진 기능 진입 게이트).
const CHECKUP_CONSENT_KEY = 'sf_checkup_consent'  // 'accepted' | null

// opt-in: 명시적으로 'accepted'인 경우에만 검진 입력·저장 허용(기본 미동의).
export function hasConsentedCheckup(): boolean {
  try {
    return localStorage.getItem(CHECKUP_CONSENT_KEY) === 'accepted'
  } catch {
    return false
  }
}

export function markCheckupConsent(): void {
  try {
    localStorage.setItem(CHECKUP_CONSENT_KEY, 'accepted')
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
  if (!hasConsentedCollection()) return  // opt-in: 동의(accepted) 없으면 저장 안 함

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
          answers: answers ?? null,   // 전체 답변 보존 (내 설문 기록 결과보기 정확 재현용)
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

    // [컴플라이언스 2026-07-08] 구 /api/survey-submit -> Google Sheets 전송 경로 제거.
    // 사유: 개인별 설문(민감정보)이 처리방침 미고지 수탁자(Google, 미국)로 이중 전송되고
    //       삭제권이 미치지 않던 P0 갭. 원본은 Supabase(위 insert)에만 저장한다.
    //       통계는 Supabase 익명 집계(뷰/RPC, k-익명성)로 대체 — 작업지시서 58.
    void payload; // (전송 페이로드 미사용 — Supabase 저장으로 일원화)
  } catch {
    // fire-and-forget: 어떤 에러도 UI에 영향 주지 않음
  }
}
