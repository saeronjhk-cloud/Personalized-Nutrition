/**
 * 한식 끼니 문법 P1 입력 로더 (IO) — 순수 판정은 domain/coaching/meal_grammar.ts
 * 최근 14일 meal_log(eaten_at, meal_slot, foods) + 안전 게이트 입력(기저질환·eGFR — v1 로더 재사용)
 * + v1 단백질 카드가 오늘 보이는지(중복 금지, 설계 §5-4).
 * 안전 입력을 못 읽으면(v1 로더 null) 카드를 내지 않는다(단백질 차단 여부를 모르면 침묵).
 */
import { supabase } from './supabase'
import { GOAL_COACHING_ENABLED, MEAL_ENABLED } from './flags'
import { loadGoalCoachingInput } from './goalCoaching'
import { goalMealCoaching } from '../domain/coaching/goal_meal_coaching'
import { windowStart, type GrammarMealRow, type MealGrammarInput } from '../domain/coaching/meal_grammar'
import { DEFAULT_MEAL_GRAMMAR_PARAMS } from '../domain/coaching/meal_grammar_params'

async function fetchWindowRows(userId: string, now: Date): Promise<GrammarMealRow[] | null> {
  const { data, error } = await supabase
    .from('meal_log')
    .select('eaten_at, meal_slot, foods')
    .eq('user_id', userId)
    .gte('eaten_at', windowStart(now, DEFAULT_MEAL_GRAMMAR_PARAMS.VERIFY_WINDOW_DAYS).toISOString())
    .order('eaten_at', { ascending: true })
    .limit(200)
  if (error || !data) return null
  return data as GrammarMealRow[]
}

export async function loadMealGrammarInput(now: Date = new Date()): Promise<MealGrammarInput | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const [v1, rows] = await Promise.all([loadGoalCoachingInput(), fetchWindowRows(user.id, now)])
  if (!v1 || rows === null) return null
  return {
    mealEnabled: MEAL_ENABLED,
    loggedIn: true,
    rows,
    now,
    conditions: v1.conditions,
    egfr: v1.egfr,
    v1CardVisible: GOAL_COACHING_ENABLED && goalMealCoaching(v1).cards.length > 0,
  }
}
