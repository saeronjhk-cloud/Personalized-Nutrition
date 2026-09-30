/**
 * 식사 결과 «음식 편집» v1 — 순수 로직 (이름 바꾸기 · 삭제 · 추가)
 * ══════════════════════════════════════════════════════════════════
 * 설계 IP/integration/meal_food_edit_design_v1.md · 평가 E01~E11 (lib/__tests__/foodEdit.test.ts)
 *
 * - 영양 숫자는 엔진(/v1/food/resolve — 사진 분석과 같은 match_with_db)이 준 값을 «쓰기만» 한다.
 *   여기서 산식으로 숫자를 만들지 않는다(앱에는 음식 DB 가 없다 — foodCorrection.ts 와 같은 원칙).
 * - 불변 갱신: 새 result 를 돌려준다 → Meal.tsx 가 상태를 통째로 바꾸면 저장·합계가 따라온다(규칙70).
 * - 합계는 매번 목록에서 다시 더한다(recomputeSummary — 표류 방지).
 * - 정정 기록(모델 개선 재료): 바꾼 음식 user_edit='renamed' + ai_name(최초 AI 이름),
 *   추가 음식 user_edit='added'. 삭제는 analysis_job.result(같은 user_id+photo_sha256)와
 *   meal_log.foods 차이로 복원 가능 → DB 컬럼을 늘리지 않는다.
 */
import type { AnalyzeResult, MealFood } from './nutrilens'
import { recomputeSummary } from './foodCorrection'

/** 엔진 resolve 결과 (backends/NutriLens/tools/food_lookup.py resolve_food) */
export interface ResolvedFood {
  name_ko: string
  db_name?: string | null
  db_matched?: boolean
  source?: string
  estimated_serving_g: number
  shape?: string | null
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sugar_g: number
  sodium_mg: number
  fiber_g: number
}

const NUTRIENTS = ['calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'sodium_mg', 'fiber_g'] as const
export const SERVING_MAX_G = 2000

function fromResolved(r: ResolvedFood): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name_ko: r.name_ko,
    db_name: r.db_name ?? r.name_ko,
    db_matched: true,
    source: r.source ?? 'GOLD_DB',
    estimated_serving_g: r.estimated_serving_g,
    match_confidence: 'user_selected',
  }
  if (r.shape != null) out.shape = r.shape
  for (const k of NUTRIENTS) out[k] = typeof r[k] === 'number' && Number.isFinite(r[k]) ? r[k] : 0
  return out
}

function withFoods(result: AnalyzeResult, foods: MealFood[]): AnalyzeResult {
  return { ...result, foods, summary: recomputeSummary(foods, result.summary) }
}

/** index 번째 음식을 엔진이 확정한 음식으로 바꾼다. resolved=null(목록에 없음) 또는 범위 밖 → 원본 그대로. */
export function renameFood(result: AnalyzeResult, index: number, resolved: ResolvedFood | null): AnalyzeResult {
  const foods = result?.foods
  if (!resolved || !Array.isArray(foods) || index < 0 || index >= foods.length) return result
  const cur = foods[index] as MealFood & Record<string, unknown>
  const added = cur.user_edit === 'added'
  const next: Record<string, unknown> = { ...cur, ...fromResolved(resolved) }
  delete next.alternates
  delete next.alternates_reason
  delete next.db_candidate
  if (Array.isArray(cur.quality_flags)) next.quality_flags = cur.quality_flags.filter((q) => q !== 'low_confidence')
  if (added) {
    next.user_edit = 'added'
    next.name_source = 'user_added'
    delete next.ai_name
  } else {
    next.user_edit = 'renamed'
    next.name_source = 'user_correction'
    next.ai_name = typeof cur.ai_name === 'string' && cur.ai_name ? cur.ai_name : cur.name_ko
  }
  const out = foods.slice()
  out[index] = next as unknown as MealFood
  return withFoods(result, out)
}

/** index 번째 음식 삭제. 범위 밖 → 원본 그대로. */
export function removeFood(result: AnalyzeResult, index: number): AnalyzeResult {
  const foods = result?.foods
  if (!Array.isArray(foods) || index < 0 || index >= foods.length) return result
  return withFoods(result, foods.filter((_, i) => i !== index))
}

/** 엔진이 확정한 음식을 끝에 추가(1인분 = 엔진 현실 서빙). resolved=null → 원본 그대로. */
export function addFood(result: AnalyzeResult, resolved: ResolvedFood | null): AnalyzeResult {
  if (!resolved || !Array.isArray(result?.foods)) return result
  const item = { ...fromResolved(resolved), user_edit: 'added', name_source: 'user_added' } as unknown as MealFood
  return withFoods(result, [...result.foods, item])
}

/** 음식이 하나 이상 있어야 저장할 수 있다. */
export function canSaveFoods(result: AnalyzeResult | null | undefined): boolean {
  return Array.isArray(result?.foods) && result!.foods.length > 0
}

/** 이름을 바꿀 때 엔진에 보낼 양 — 사진 추정량을 유지한다(유효 범위 밖이면 null → 엔진 1인분). */
export function renameRequestServing(food: MealFood | null | undefined): number | null {
  const v = (food as { estimated_serving_g?: unknown } | null | undefined)?.estimated_serving_g
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= SERVING_MAX_G ? v : null
}
