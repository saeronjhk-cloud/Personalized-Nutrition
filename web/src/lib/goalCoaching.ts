/**
 * 목표 기반 식사 코칭 입력 로더 (IO) — 순수 판정은 domain/coaching/goal_meal_coaching.ts
 * 오늘(브라우저 로컬 날짜) meal_log + 유효 목표 + 최신 설문(체중·신장·나이·기저질환) + 최신 검진 eGFR(성별·나이는 검진 프로필 우선).
 * 실패는 조용히 «카드 없음» 쪽으로(코칭은 부가 기능 — 추천·기록 흐름을 막지 않는다).
 */
import { supabase } from './supabase'
import { CHECKUP_ENABLED, MEAL_ENABLED } from './flags'
import { loadEffectiveGoals } from './userGoals'
import { fetchSurveyResponses, fetchSurveyResponseDetail } from './survey_api'
import { fetchCheckupRecords, fetchCheckupRecordDetail, fetchMyProfile } from './checkup_api'
import { resolveEgfr } from '../domain/checkup/egfr'
import { egfrDemographics } from '../domain/checkup/egfr_inputs'
import { mealRowsToCoachMeals, type CoachingInput, type CoachMealRow } from '../domain/coaching/goal_meal_coaching'
import { proteinRoleBySlot } from '../domain/coaching/meal_grammar'

/** 오늘 0시(로컬) — 운영 브라우저는 KST */
export function startOfLocalDay(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

async function fetchTodayMealRows(userId: string): Promise<CoachMealRow[] | null> {
  const { data, error } = await supabase
    .from('meal_log')
    .select('eaten_at, meal_slot, summary, adjusted_summary, foods')
    .eq('user_id', userId)
    .gte('eaten_at', startOfLocalDay().toISOString())
    .order('eaten_at', { ascending: true })
    .limit(50)
  if (error || !data) return null
  return data as CoachMealRow[]
}

/** 최신 검진 수치+검진일(CHECKUP 켜짐만) — eGFR 은 아래 resolveEgfr 로 측정값 우선, 없으면 크레아티닌 CKD-EPI 2021 산출
 *  (운영 DB 에 'egfr' 키 없음 10-02 확인 · 평가 IP/integration/egfr_ckd_epi_eval_v1.md) */
async function fetchLatestCheckup(userId: string): Promise<{ values: Record<string, { value: number; unit?: string | null }>; recordedDate: string | null } | null> {
  if (!CHECKUP_ENABLED) return null
  const recs = await fetchCheckupRecords(userId)
  if (recs.records.length === 0) return null
  const d = await fetchCheckupRecordDetail(recs.records[0].id, userId)
  return d.detail ? { values: d.detail.values, recordedDate: d.detail.recorded_date ?? null } : null
}

export async function loadGoalCoachingInput(): Promise<CoachingInput | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const [goals, surveys, checkup, rows, prof] = await Promise.all([
    loadEffectiveGoals(user.id),
    fetchSurveyResponses(user.id),
    fetchLatestCheckup(user.id),
    fetchTodayMealRows(user.id),
    CHECKUP_ENABLED ? fetchMyProfile() : Promise.resolve(null),
  ])
  if (rows === null) return null
  const latest = surveys.responses[0]
  const det = latest ? (await fetchSurveyResponseDetail(latest.id, user.id)).detail ?? null : null
  const a = det?.answers ?? null
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
  // eGFR 성별·나이: 검진 프로필 우선 → 설문 실응답 → 미상(낮은 값) — IP/integration/egfr_ckd_epi_eval_v1.md v2 (E15~E25)
  const demo = egfrDemographics({
    profileSex: prof?.profile?.sex,
    profileBirthYear: prof?.profile?.birth_year,
    recordedDate: checkup?.recordedDate,
    surveySex: a?.성별,
    surveySexKnown: det?.genderKnown ?? false,
    surveyAge: num(a?.나이),
  })
  const egfr = resolveEgfr(checkup?.values ?? null, demo.age, demo.sex).value
  return {
    mealEnabled: MEAL_ENABLED,
    loggedIn: true,
    goals: goals.goals,
    weightKg: num(a?.체중),
    heightCm: num(a?.신장),
    age: num(a?.나이),
    conditions: Array.isArray(a?.기저질환) ? a!.기저질환 : [],
    egfr,
    meals: mealRowsToCoachMeals(rows),
    // 단백질 주 판정 = 반찬 있음/없음(D-SIM1) — 사진 g 과소추정 오경보 제거
    proteinRoleBySlot: proteinRoleBySlot(rows.map((r) => ({ eaten_at: r.eaten_at, meal_slot: r.meal_slot, foods: r.foods ?? null })), new Date()),
  }
}
