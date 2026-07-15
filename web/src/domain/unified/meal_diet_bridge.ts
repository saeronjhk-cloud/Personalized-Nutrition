/**
 * 식이→추천 배선 브리지 (Phase E.4 · "통합의 심장")
 * meal_log 행(summary/adjusted_summary JSON) → aggregateMeals 입력(MealRecord[]) → DietDailyAvg.
 * 엔진/집계/어댑터 미수정 — 순수 매핑만 추가(엔진 우선 원칙 유지).
 *
 * 보수적 v1 정책(사용자 결정 2026-07-10):
 *  - 잔반 보정된 실섭취(adjusted_summary)를 우선 사용, 없으면 원본 summary.
 *  - meal_log summary는 영양소별 미상 플래그를 담지 않으므로, 나트륨·당류·식이섬유는
 *    '미상'(known=false)으로 보류 → 칼로리·단백질 신호만 발화("저염/저당 오판" 방지).
 */
import type { MealRecord } from "./meal_aggregate";
import { aggregateMeals } from "./meal_aggregate";
import type { DietDailyAvg } from "./diet_adapter";

/** meal_log의 summary/adjusted_summary JSON 형태(필요 필드만, 전부 선택적). */
export interface MealSummaryLike {
  total_calories_kcal?: number | null;
  total_protein_g?: number | null;
  total_carbs_g?: number | null;
  total_fat_g?: number | null;
  total_sodium_mg?: number | null;
  total_sugar_g?: number | null;
  total_fiber_g?: number | null;
}

/** meal_log 1행(집계에 필요한 컬럼만). */
export interface MealLogRow {
  eaten_at: string;
  summary?: MealSummaryLike | null;
  /** 잔반 보정 후 실섭취(있으면 우선). */
  adjusted_summary?: MealSummaryLike | null;
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && isFinite(v) ? v : 0;
}

/**
 * meal_log 1행 → aggregateMeals용 MealRecord.
 * 실섭취 우선(adjusted_summary ?? summary). 미세영양 known=false(보수적 v1).
 */
export function mealLogRowToDietRecord(row: MealLogRow): MealRecord {
  const s: MealSummaryLike = (row.adjusted_summary ?? row.summary ?? {}) as MealSummaryLike;
  return {
    eaten_at: row.eaten_at,
    kcal: num(s.total_calories_kcal),
    protein_g: num(s.total_protein_g),
    carbs_g: num(s.total_carbs_g),
    fat_g: num(s.total_fat_g),
    sugar_g: num(s.total_sugar_g),
    sodium_mg: num(s.total_sodium_mg),
    fiber_g: num(s.total_fiber_g),
    // 보수적 v1: 미상 플래그 부재 → 나트륨·당류·식이섬유 신호 보류.
    sodium_known: false,
    sugar_known: false,
    fiber_known: false,
  };
}

/** meal_log 행 배열 → 최근 windowDays일 DietDailyAvg. */
export function mealLogRowsToDietSummary(rows: MealLogRow[], windowDays = 7): DietDailyAvg {
  if (!rows || rows.length === 0) {
    return aggregateMeals([], windowDays);
  }
  return aggregateMeals(rows.map(mealLogRowToDietRecord), windowDays);
}
