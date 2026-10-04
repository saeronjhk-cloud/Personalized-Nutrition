/**
 * 저장된 식사 «음식 편집» v1 — 순수 로직 + 저장 IO
 * ══════════════════════════════════════════════════════════════════
 * 설계 IP/integration/meal_saved_edit_design_v1.md · 평가 I·S (lib/__tests__/mealSavedEdit.test.ts)
 *
 * - 저장 전 편집(foodEdit.ts)의 rename/remove/add 를 그대로 재사용한다(영양 = 엔진 resolve 값만, 합계 = 재합산).
 * - 편집 시작 때 food_item_id 를 굳힌다 → 삭제해도 남은 음식 id 가 밀리지 않는다(잔반 per_food 매핑 보존).
 * - 보정(먹은 양)된 식사는 저장 때 보정을 초기화한다(제이 결정 D2) — 잔반은 현재 foods 기준으로 다시 계산되므로.
 * - 저장 = UPDATE 1회 + updated_at 낙관적 잠금(다른 기기에서 바뀌었으면 덮어쓰지 않는다).
 */
import { supabase } from './supabase'
import type { AnalyzeResult, MealFood, MealSummary } from './nutrilens'
import { renameFood, removeFood, addFood, addProductFood, assignFoodItemIds, nextFoodItemId, type ResolvedFood } from './foodEdit'
import { isAdjusted, type MealRecord } from './mealHistory'

export interface SavedEditDraft {
  foods: MealFood[]
  summary: MealSummary
  dirty: boolean
  /** 이 기록에 한 번이라도 있었던 id — 지운 번호를 새 음식에 다시 주지 않기 위함 */
  knownIds: string[]
}

export const EMPTY_FOODS_MSG = '음식이 하나는 있어야 해요. 식사 전체를 지우려면 ✕ 를 눌러 주세요.'
export const CONFLICT_MSG = '다른 곳에서 이 식사가 바뀌었어요. 새로고침 후 다시 해 주세요.'
export const LEFTOVER_RESET_CONFIRM = '이 접시의 «먹은 양» 보정이 초기화돼요(100%로 돌아감). 필요하면 저장 뒤 다시 조절해 주세요. 저장할까요?'

/** 보정 초기화 — 다음 보정은 새 foods 기준으로 처음부터(meal-leftover 가 original_summary 를 다시 잡는다). */
export const LEFTOVER_RESET = Object.freeze({
  adjusted_summary: null,
  original_summary: null,
  eaten_ratio: 1,
  leftover_method: 'none',
  leftover_note: null,
  leftover_confidence: null,
  leftover_adjusted_at: null,
  leftover_engine_version: null,
})

function asResult(d: SavedEditDraft): AnalyzeResult {
  return { foods: d.foods, summary: d.summary } as unknown as AnalyzeResult
}
function fromResult(r: AnalyzeResult, prev: SavedEditDraft): SavedEditDraft {
  if (r.foods === prev.foods) return prev
  return { ...prev, foods: r.foods as MealFood[], summary: r.summary as MealSummary, dirty: true }
}
function stamp(f: MealFood): MealFood {
  return { ...f, edit_stage: 'after_save' }
}

/** 편집 시작 — id 를 굳힌 초안(원본 record 불변). */
export function startSavedEdit(rec: MealRecord): SavedEditDraft {
  const foods = assignFoodItemIds(rec.foods ?? [])
  return {
    foods, summary: { ...(rec.summary ?? {}) } as MealSummary, dirty: false,
    knownIds: foods.map((f) => f.food_item_id).filter((x): x is string => !!x),
  }
}

export function draftRename(d: SavedEditDraft, index: number, resolved: ResolvedFood | null): SavedEditDraft {
  const next = fromResult(renameFood(asResult(d), index, resolved), d)
  if (next === d) return d
  const foods = next.foods.slice()
  foods[index] = stamp(foods[index])
  return { ...next, foods }
}

export function draftRemove(d: SavedEditDraft, index: number): SavedEditDraft {
  return fromResult(removeFood(asResult(d), index), d)
}

export function draftAdd(d: SavedEditDraft, resolved: ResolvedFood | null): SavedEditDraft {
  const next = fromResult(addFood(asResult(d), resolved), d)
  if (next === d) return d
  const foods = next.foods.slice()
  const last = foods.length - 1
  const id = nextFoodItemId(d.knownIds.map((k) => ({ food_item_id: k })))
  foods[last] = stamp({ ...foods[last], food_item_id: id })
  return { ...next, foods, knownIds: [...d.knownIds, id] }
}

/** 가공식품(먹선 /portion 값)을 초안 끝에 — 새 id(지운 번호 재사용 금지) + after_save 표식. 설계 meal_saved_edit_product D3 */
export function draftAddProduct(d: SavedEditDraft, food: MealFood | null): SavedEditDraft {
  const next = fromResult(addProductFood(asResult(d), food), d)
  if (next === d) return d
  const foods = next.foods.slice()
  const last = foods.length - 1
  const id = nextFoodItemId(d.knownIds.map((k) => ({ food_item_id: k })))
  foods[last] = stamp({ ...foods[last], food_item_id: id })
  return { ...next, foods, knownIds: [...d.knownIds, id] }
}

export function canSaveDraft(d: SavedEditDraft | null | undefined): boolean {
  return !!d && Array.isArray(d.foods) && d.foods.length > 0
}

/** 보정된 기록이면 저장 전에 확인을 받아야 한다. */
export function needsLeftoverResetConfirm(rec: MealRecord): boolean {
  return isAdjusted(rec)
}

/** UPDATE 페이로드. 바뀐 것 없거나 음식 0개면 null(저장하지 않음). 사진·시각·끼니·source 는 넣지 않는다. */
export function buildSavedEditUpdate(rec: MealRecord, d: SavedEditDraft): Record<string, unknown> | null {
  if (!d.dirty || !canSaveDraft(d)) return null
  const out: Record<string, unknown> = { foods: d.foods, summary: d.summary }
  if (needsLeftoverResetConfirm(rec)) Object.assign(out, LEFTOVER_RESET)
  return out
}

export type SaveEditResult = { ok: true } | { ok: false; conflict?: boolean; message: string }

/**
 * 저장 — 호출 전에 화면이 (보정된 기록이면) LEFTOVER_RESET_CONFIRM 확인을 받아야 한다.
 * updated_at 이 불러온 값과 같을 때만 갱신(0행 → conflict).
 */
export async function saveSavedEdit(rec: MealRecord, d: SavedEditDraft): Promise<SaveEditResult> {
  const payload = buildSavedEditUpdate(rec, d)
  if (!payload) return canSaveDraft(d) ? { ok: true } : { ok: false, message: EMPTY_FOODS_MSG }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: '로그인이 필요합니다' }
  let q = supabase.from('meal_log').update(payload).eq('id', rec.id).eq('user_id', user.id)
  if (rec.updated_at) q = q.eq('updated_at', rec.updated_at)
  const { data, error } = await q.select('id')
  if (error) return { ok: false, message: `저장 실패: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, conflict: true, message: CONFLICT_MSG }
  return { ok: true }
}
