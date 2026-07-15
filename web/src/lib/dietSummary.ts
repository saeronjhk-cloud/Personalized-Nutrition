/**
 * 최근 식이 요약 로더 (식이→추천 배선의 IO 레이어)
 * meal_log(RLS 본인) 최근 windowDays일 → 순수 브리지로 DietDailyAvg 산출.
 * 로그인 없거나 기록 없으면 null(추천은 설문/검진만으로 계속).
 */
import { supabase } from './supabase'
import { mealLogRowsToDietSummary, type MealLogRow } from '../domain/unified/meal_diet_bridge'
import type { DietDailyAvg } from '../domain/unified/diet_adapter'

export async function loadRecentDietSummary(windowDays = 7): Promise<DietDailyAvg | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const since = new Date()
  since.setDate(since.getDate() - windowDays)
  const { data, error } = await supabase
    .from('meal_log')
    .select('eaten_at, summary, adjusted_summary')
    .eq('user_id', user.id)
    .gte('eaten_at', since.toISOString())
    .order('eaten_at', { ascending: false })
    .limit(200)
  if (error || !data || data.length === 0) return null
  return mealLogRowsToDietSummary(data as MealLogRow[], windowDays)
}
