/**
 * 정찬 세션 client — 서버 계약(IP 82) 소비. lifecycle은 서버 RPC가 canonical.
 * open/close = RPC(원자적·멱등). 현재 세션·합계 = meal_session_summary 뷰(security_invoker).
 */
import { supabase } from './supabase'
import { friendlySessionError, firstRow } from './session_math'
import { genIdemKey } from './leftover_math'

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface OpenSessionResult {
  session_id: string
  auto_closed: boolean
  auto_closed_session_id: string | null
  replayed: boolean
}
export interface CloseSessionResult {
  session_id: string
  status: string
  closed_reason: string
  ended_at: string
  replayed: boolean
}
export interface SessionSummary {
  session_id: string
  user_id: string
  status: string
  meal_slot: MealSlot | null
  started_at: string
  ended_at: string | null
  closed_reason: string | null
  plate_count: number
  total_calories_kcal: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_sodium_mg: number
  total_sugar_g: number
  last_plate_at: string
}

/** 정찬 시작(기존 open 자동종료 + 새 open, 서버 단일 트랜잭션). 멱등키는 start 제스처당 하나. */
export async function openMealSession(mealSlot?: MealSlot | null, idemKey: string = genIdemKey()): Promise<OpenSessionResult> {
  const { data, error } = await supabase.rpc('open_meal_session', { p_meal_slot: mealSlot ?? null, p_idempotency_key: idemKey })
  if (error) throw new Error(friendlySessionError(error.message))
  const row = firstRow<OpenSessionResult>(data)
  if (!row) throw new Error('정찬을 시작하지 못했어요.')
  return row
}

/** 정찬 종료(user_ended). 멱등. */
export async function closeMealSession(sessionId: string, idemKey: string = genIdemKey()): Promise<CloseSessionResult> {
  const { data, error } = await supabase.rpc('close_meal_session', { p_session_id: sessionId, p_idempotency_key: idemKey })
  if (error) throw new Error(friendlySessionError(error.message))
  const row = firstRow<CloseSessionResult>(data)
  if (!row) throw new Error('정찬을 종료하지 못했어요.')
  return row
}

/** 현재 열린 정찬(있으면). 합계 뷰 기준. */
export async function getCurrentOpenSession(): Promise<SessionSummary | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('meal_session_summary')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'open')
    .order('started_at', { ascending: false })
    .limit(1)
  if (error || !data || !data.length) return null
  return data[0] as SessionSummary
}

/** 특정 세션 요약(접시수·합계). */
export async function getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
  const { data, error } = await supabase
    .from('meal_session_summary')
    .select('*')
    .eq('session_id', sessionId)
    .limit(1)
  if (error || !data || !data.length) return null
  return data[0] as SessionSummary
}
