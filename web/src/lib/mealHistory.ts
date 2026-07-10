// 최근 식사 기록(리텐션 B축) — 본인 소유 meal_log 조회/삭제 + 주간 요약.
// 사진은 프라이빗 버킷(meal-photos) → signed URL로 썸네일. 삭제=사진+row hard-delete.
import { supabase } from './supabase'
import type { MealFood, MealSummary } from './nutrilens'

export interface MealRecord {
  id: string
  eaten_at: string
  meal_slot: string | null
  foods: MealFood[]
  summary: MealSummary
  photo_path: string | null
  thumbUrl?: string | null
}

const SLOT_LABEL: Record<string, string> = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' }
export function slotLabel(s: string | null): string { return (s && SLOT_LABEL[s]) || '식사' }

function num(v: unknown): number { return typeof v === 'number' && isFinite(v) ? v : 0 }
export function kcalOf(r: MealRecord): number { return Math.round(num((r.summary as any)?.total_calories_kcal)) }
export function titleOf(r: MealRecord): string {
  const names = (r.foods ?? []).map((f) => f.name_ko).filter(Boolean)
  if (!names.length) return '식사'
  return names.length <= 2 ? names.join(', ') : `${names[0]} 외 ${names.length - 1}`
}

/** 최근 meal_log(최신순) + 사진 signed URL. 로그인 필요(RLS 본인). */
export async function listMeals(limit = 30): Promise<MealRecord[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('meal_log')
    .select('id, eaten_at, meal_slot, foods, summary, photo_path')
    .eq('user_id', user.id)
    .order('eaten_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  const rows = data as any[]
  const paths = rows.map((r) => r.photo_path).filter(Boolean) as string[]
  const signed: Record<string, string> = {}
  if (paths.length) {
    const { data: sd } = await supabase.storage.from('meal-photos').createSignedUrls(paths, 3600)
    for (const s of sd ?? []) if (s.path && s.signedUrl) signed[s.path] = s.signedUrl
  }
  return rows.map((r) => ({
    id: String(r.id),
    eaten_at: r.eaten_at,
    meal_slot: r.meal_slot ?? null,
    foods: (r.foods ?? []) as MealFood[],
    summary: (r.summary ?? {}) as MealSummary,
    photo_path: r.photo_path ?? null,
    thumbUrl: r.photo_path ? signed[r.photo_path] ?? null : null,
  }))
}

/** 식사 1건 삭제 — [PIPA] 사진(고아 방지 먼저) + row hard-delete. */
export async function deleteMeal(rec: MealRecord): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  if (rec.photo_path) {
    try { await supabase.storage.from('meal-photos').remove([rec.photo_path]) } catch { /* 사진 없어도 계속 */ }
  }
  const { data, error } = await supabase.from('meal_log').delete().eq('id', rec.id).eq('user_id', user.id).select('id')
  return !error && !!data && data.length > 0
}

export interface MealStat {
  total: number
  todayKcal: number
  todayCount: number
  last7Days: number
}

/** 결정적 요약(오늘 섭취·최근 7일). 로컬 일자 기준. */
export function summarizeMeals(records: MealRecord[], now: Date = new Date()): MealStat {
  const nowMs = now.getTime()
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  const todayKey = dayKey(now)
  let todayKcal = 0, todayCount = 0, last7Days = 0
  for (const r of records) {
    const t = new Date(r.eaten_at)
    const ms = t.getTime()
    if (Number.isNaN(ms)) continue
    if (dayKey(t) === todayKey) { todayKcal += kcalOf(r); todayCount++ }
    if (nowMs - ms <= 7 * 24 * 3600 * 1000 && ms <= nowMs) last7Days++
  }
  return { total: records.length, todayKcal: Math.round(todayKcal), todayCount, last7Days }
}
