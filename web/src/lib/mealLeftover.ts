/**
 * 잔반(먹은 양) 보정 클라이언트 — Path A(슬라이더, 결정론) · IO 레이어.
 * 백엔드 계약: IP 통합앱_P1/40·27_v2.1.1. Edge: POST /functions/v1/meal-leftover.
 * 원칙5: 클라는 영양 재계산 안 함(서버 adjusted_summary만 신뢰). pre_summary 미전송.
 */
import { supabase } from './supabase'
import type { MealSummary } from './nutrilens'
import {
  buildSliderBody, buildSessionSliderBody, buildPerFoodBody, buildPhotoAiSuggestBody, buildPhotoAiConfirmBody,
  parsePhotoAiSuggest, isValidRatio, parseLeftoverEnvelope, genIdemKey, LEFTOVER_ERR_MSG,
  type PhotoAiSuggestion,
} from './leftover_math'
import { reencodeImage } from './nutrilens'

export type { LeftoverErrorCode, ParsedEnvelope } from './leftover_math'
export { clampRatio, isValidRatio, buildSliderBody, buildSessionSliderBody, buildPerFoodBody, foodItemId, splitRatio, buildPhotoAiSuggestBody, buildPhotoAiConfirmBody, parsePhotoAiSuggest, parseLeftoverEnvelope, friendlyLeftoverError, genIdemKey } from './leftover_math'
export type { PhotoAiSuggestion } from './leftover_math'

const BASE = import.meta.env.VITE_SUPABASE_URL || ''
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export interface LeftoverResult {
  adjusted_summary: MealSummary
  pre_summary: MealSummary
  state?: string
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('로그인이 필요합니다')
  return { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' }
}

/**
 * 단건 식사(pre_meal_log_id)에 먹은 양 비율(0~1) 반영. 결정론(AI 미호출)·즉시.
 * 재조정도 항상 원본 기준(서버가 원본×ratio 재계산). 성공 시 adjusted_summary 반환.
 */
export async function adjustSliderSingle(preMealLogId: string, eatenRatio: number): Promise<LeftoverResult> {
  if (!isValidRatio(eatenRatio)) throw new Error('먹은 양은 0~100% 사이여야 해요.')
  const res = await fetch(`${BASE}/functions/v1/meal-leftover`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'X-Idempotency-Key': genIdemKey() },
    body: JSON.stringify(buildSliderBody(preMealLogId, eatenRatio)),
  })
  let json: any = {}
  try { json = await res.json() } catch { /* 비-JSON */ }
  const parsed = parseLeftoverEnvelope(json, res.status)
  if (!parsed.ok || !parsed.data) throw new Error(parsed.errorMessage || LEFTOVER_ERR_MSG.UNKNOWN)
  return {
    adjusted_summary: parsed.data.adjusted_summary as MealSummary,
    pre_summary: parsed.data.pre_summary as MealSummary,
    state: parsed.data.state,
  }
}

/**
 * 종료된 정찬 세션 전체(pre_meal_session_id)에 먹은 양 비율 반영. 세션이 open이면 서버가 409(SESSION_STILL_OPEN).
 */
export async function adjustSliderSession(preMealSessionId: string, sessionEatenRatio: number): Promise<LeftoverResult> {
  if (!isValidRatio(sessionEatenRatio)) throw new Error('먹은 양은 0~100% 사이여야 해요.')
  const res = await fetch(`${BASE}/functions/v1/meal-leftover`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'X-Idempotency-Key': genIdemKey() },
    body: JSON.stringify(buildSessionSliderBody(preMealSessionId, sessionEatenRatio)),
  })
  let json: any = {}
  try { json = await res.json() } catch { /* 비-JSON */ }
  const parsed = parseLeftoverEnvelope(json, res.status)
  if (!parsed.ok || !parsed.data) throw new Error(parsed.errorMessage || LEFTOVER_ERR_MSG.UNKNOWN)
  return {
    adjusted_summary: parsed.data.adjusted_summary as MealSummary,
    pre_summary: parsed.data.pre_summary as MealSummary,
    state: parsed.data.state,
  }
}

// ───────── Path B (식후사진 AI) IO ─────────

/** Blob → base64(데이터URL 접두사 제외). */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => {
      const s = String(fr.result || '')
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    fr.onerror = () => reject(new Error('이미지를 읽을 수 없어요'))
    fr.readAsDataURL(blob)
  })
}

/** 제안(suggest): 식후사진 → AI 추정 비율/미리보기. 저장 아님(meal_log 미갱신). 실패 시 AI_ESTIMATE_FAILED. */
export async function suggestPhotoAi(preMealLogId: string, file: File | Blob): Promise<PhotoAiSuggestion> {
  const blob = await reencodeImage(file)
  const b64 = await blobToBase64(blob)
  const res = await fetch(`${BASE}/functions/v1/meal-leftover`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'X-Idempotency-Key': genIdemKey() },
    body: JSON.stringify(buildPhotoAiSuggestBody(preMealLogId, b64, 'image/jpeg')),
  })
  let json: any = {}
  try { json = await res.json() } catch { /* 비-JSON */ }
  const parsed = parseLeftoverEnvelope(json, res.status)
  if (!parsed.ok || !parsed.data) throw new Error(parsed.errorMessage || LEFTOVER_ERR_MSG.AI_ESTIMATE_FAILED)
  return parsePhotoAiSuggest(parsed.data)
}

/** 확인(confirm): 사용자가 비율 확정 → 결정론 재계산 + meal_log 갱신. 카드 확정 갱신은 이때만. */
export async function confirmPhotoAi(preMealLogId: string, confirmedEatenRatio: number): Promise<LeftoverResult> {
  if (!isValidRatio(confirmedEatenRatio)) throw new Error('먹은 양은 0~100% 사이여야 해요.')
  const res = await fetch(`${BASE}/functions/v1/meal-leftover`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'X-Idempotency-Key': genIdemKey() },
    body: JSON.stringify(buildPhotoAiConfirmBody(preMealLogId, confirmedEatenRatio)),
  })
  let json: any = {}
  try { json = await res.json() } catch { /* 비-JSON */ }
  const parsed = parseLeftoverEnvelope(json, res.status)
  if (!parsed.ok || !parsed.data) throw new Error(parsed.errorMessage || LEFTOVER_ERR_MSG.UNKNOWN)
  return {
    adjusted_summary: parsed.data.adjusted_summary as MealSummary,
    pre_summary: parsed.data.pre_summary as MealSummary,
    state: parsed.data.state,
  }
}

/** 음식별(per_food) 조절 — 단건 meal. per_food는 모든 음식 커버 필요. 서버 결정론(원본×음식별비율). */
export async function adjustPerFood(preMealLogId: string, perFood: { food_item_id: string; eaten_ratio: number }[]): Promise<LeftoverResult> {
  if (!perFood.length) throw new Error('음식 정보를 찾을 수 없어요.')
  for (const x of perFood) if (!isValidRatio(x.eaten_ratio)) throw new Error('먹은 양은 0~100% 사이여야 해요.')
  const res = await fetch(`${BASE}/functions/v1/meal-leftover`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'X-Idempotency-Key': genIdemKey() },
    body: JSON.stringify(buildPerFoodBody(preMealLogId, perFood)),
  })
  let json: any = {}
  try { json = await res.json() } catch { /* 비-JSON */ }
  const parsed = parseLeftoverEnvelope(json, res.status)
  if (!parsed.ok || !parsed.data) throw new Error(parsed.errorMessage || LEFTOVER_ERR_MSG.UNKNOWN)
  return {
    adjusted_summary: parsed.data.adjusted_summary as MealSummary,
    pre_summary: parsed.data.pre_summary as MealSummary,
    state: parsed.data.state,
  }
}
