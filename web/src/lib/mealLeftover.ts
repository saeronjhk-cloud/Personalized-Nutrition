/**
 * 잔반(먹은 양) 보정 클라이언트 — Path A(슬라이더, 결정론) · IO 레이어.
 * 백엔드 계약: IP 통합앱_P1/40·27_v2.1.1. Edge: POST /functions/v1/meal-leftover.
 * 원칙5: 클라는 영양 재계산 안 함(서버 adjusted_summary만 신뢰). pre_summary 미전송.
 */
import { supabase } from './supabase'
import type { MealSummary } from './nutrilens'
import {
  buildSliderBody, isValidRatio, parseLeftoverEnvelope, genIdemKey, LEFTOVER_ERR_MSG,
} from './leftover_math'

export type { LeftoverErrorCode, ParsedEnvelope } from './leftover_math'
export { clampRatio, isValidRatio, buildSliderBody, parseLeftoverEnvelope, friendlyLeftoverError, genIdemKey } from './leftover_math'

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
