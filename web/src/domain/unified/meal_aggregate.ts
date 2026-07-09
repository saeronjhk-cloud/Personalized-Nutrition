/**
 * meal_records → DietDailyAvg 집계 (파이프라인 1단계: known 가드 연결)
 * 근거: D:\헬스픽\IP\nutrilens_production_readiness_v1.md (파이프라인 개통 = 최대 blocker)
 *
 * 핵심: NutriLens가 적재한 끼니별 영양 point + 신뢰 플래그(sodium_known/...)를
 * 최근 N일 일평균으로 집계하면서, "미상 1건이라도 있으면 그 영양소는 신뢰 불가"를 전파.
 * 결과 DietDailyAvg의 known 플래그를 dietToScores(Step4 가드)가 그대로 소비 → 잘못된 신호 차단.
 */
import type { DietDailyAvg } from "./diet_adapter";

/** Supabase meal_records 1행(필요 컬럼만) */
export interface MealRecord {
  eaten_at: string; // ISO
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  fiber_g?: number | null;
  sodium_known?: boolean | null;
  sugar_known?: boolean | null;
  fiber_known?: boolean | null;
}

function dateKey(iso: string): string {
  // 로컬 일자 키 (YYYY-MM-DD). NutriLens와 동일하게 로컬 시간 기준.
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * 최근 windowDays일 meal_records를 일평균으로 집계.
 * - 일평균 = (창 내 합계) / (기록된 일수).  기록 일수 < 2면 dietToScores가 lowConfidence 처리.
 * - known 플래그: 창 내 어떤 끼니라도 해당 영양소 known===false면 전체 false(미상 1건이면 보류).
 *   (값 자체가 없거나 플래그 미지정이면 보수적으로 보류 처리)
 */
export function aggregateMeals(records: MealRecord[], windowDays = 7): DietDailyAvg {
  if (!records || records.length === 0) {
    return { days: 0, kcal: 0, protein_g: 0, sugar_g: 0, sodium_mg: 0, fiber_g: 0,
      sodium_known: false, sugar_known: false, fiber_known: false };
  }
  // 최근 windowDays 일자만
  const sorted = [...records].sort((a, b) => (a.eaten_at < b.eaten_at ? 1 : -1));
  const latest = new Date(sorted[0].eaten_at);
  const cutoff = new Date(latest);
  cutoff.setDate(cutoff.getDate() - (windowDays - 1));
  const inWindow = sorted.filter((r) => new Date(r.eaten_at) >= cutoff);

  const dayset = new Set<string>();
  let kcal = 0, protein = 0, sugar = 0, sodium = 0, fiber = 0;
  let sodiumKnown = true, sugarKnown = true, fiberKnown = true;

  for (const r of inWindow) {
    dayset.add(dateKey(r.eaten_at));
    kcal += r.kcal ?? 0;
    protein += r.protein_g ?? 0;
    sugar += r.sugar_g ?? 0;
    sodium += r.sodium_mg ?? 0;
    fiber += r.fiber_g ?? 0;
    // 미상 1건이라도 있으면 보류 (플래그 false거나, 값 누락)
    if (r.sodium_known === false || r.sodium_mg == null) sodiumKnown = false;
    if (r.sugar_known === false || r.sugar_g == null) sugarKnown = false;
    if (r.fiber_known === false || r.fiber_g == null) fiberKnown = false;
  }

  const days = dayset.size;
  const avg = (sum: number) => (days > 0 ? sum / days : 0);

  return {
    days,
    kcal: avg(kcal),
    protein_g: avg(protein),
    sugar_g: avg(sugar),
    sodium_mg: avg(sodium),
    fiber_g: avg(fiber),
    sodium_known: sodiumKnown,
    sugar_known: sugarKnown,
    fiber_known: fiberKnown,
  };
}
