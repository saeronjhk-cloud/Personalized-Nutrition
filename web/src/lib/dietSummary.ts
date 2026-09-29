/**
 * 최근 식이 요약 로더 (식이→추천 배선의 IO 레이어)
 * meal_log(RLS 본인) 최근 windowDays일 → 순수 브리지로 DietDailyAvg 산출.
 * 로그인 없거나 기록 없으면 null(추천은 설문/검진만으로 계속).
 */
import { supabase } from './supabase'
import { mealLogRowsToDietSummary, type MealLogRow } from '../domain/unified/meal_diet_bridge'
import type { DietDailyAvg } from '../domain/unified/diet_adapter'

type RecentRows = { ok: true; rows: MealLogRow[] } | { ok: false; reason: 'guest' | 'error' }

async function fetchRecentMealRows(windowDays: number): Promise<RecentRows> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'guest' }
  const since = new Date()
  since.setDate(since.getDate() - windowDays)
  const { data, error } = await supabase
    .from('meal_log')
    .select('eaten_at, summary, adjusted_summary')
    .eq('user_id', user.id)
    .gte('eaten_at', since.toISOString())
    .order('eaten_at', { ascending: false })
    .limit(200)
  if (error || !data) return { ok: false, reason: 'error' }
  return { ok: true, rows: data as MealLogRow[] }
}

export async function loadRecentDietSummary(windowDays = 7): Promise<DietDailyAvg | null> {
  const r = await fetchRecentMealRows(windowDays)
  if (!r.ok || r.rows.length === 0) return null
  return mealLogRowsToDietSummary(r.rows, windowDays)
}

/**
 * «내 건강» 식이 카드용 (Phase H): 최근 windowDays일 기록 일수.
 * 추천과 같은 쿼리·같은 집계(aggregateMeals.days). 조회 실패는 null(«기록 없음»과 구분).
 */
export async function loadRecentMealDays(windowDays = 7): Promise<number | null> {
  const r = await fetchRecentMealRows(windowDays)
  if (!r.ok) return r.reason === 'guest' ? 0 : null
  if (r.rows.length === 0) return 0
  return mealLogRowsToDietSummary(r.rows, windowDays).days
}
