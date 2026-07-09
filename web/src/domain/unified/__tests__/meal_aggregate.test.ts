/**
 * 파이프라인 집계 Eval — meal_records → DietDailyAvg(+known 가드)
 * 참조: D:\헬스픽\IP\nutrilens_production_readiness_v1.md
 */
import { describe, it, expect } from "vitest";
import { aggregateMeals, type MealRecord } from "../meal_aggregate";
import { dietToScores } from "../diet_adapter";

const day = (d: number) => `2026-06-${String(d).padStart(2, "0")}T12:00:00+09:00`;

describe("aggregateMeals (known 가드 전파)", () => {
  it("빈 입력 → days 0, 모든 known false", () => {
    const a = aggregateMeals([]);
    expect(a.days).toBe(0);
    expect(a.sodium_known).toBe(false);
  });

  it("2일·전부 known → 일평균 + known true", () => {
    const recs: MealRecord[] = [
      { eaten_at: day(20), kcal: 2000, protein_g: 60, sugar_g: 40, sodium_mg: 2400, fiber_g: 20, sodium_known: true, sugar_known: true, fiber_known: true },
      { eaten_at: day(21), kcal: 2000, protein_g: 60, sugar_g: 40, sodium_mg: 2400, fiber_g: 20, sodium_known: true, sugar_known: true, fiber_known: true },
    ];
    const a = aggregateMeals(recs);
    expect(a.days).toBe(2);
    expect(a.sodium_mg).toBe(2400); // 일평균 (2일 각 2400 → 4800/2)
    expect(a.sodium_known).toBe(true);
  });

  it("미상 1건이라도 있으면 그 영양소 known false (보류 전파)", () => {
    const recs: MealRecord[] = [
      { eaten_at: day(20), kcal: 2000, sodium_mg: 2400, sugar_g: 40, fiber_g: 20, sodium_known: true, sugar_known: true, fiber_known: true },
      { eaten_at: day(21), kcal: 2000, sodium_mg: 2400, sugar_g: 90, fiber_g: 20, sodium_known: true, sugar_known: false, fiber_known: true }, // 당류 미상
    ];
    const a = aggregateMeals(recs);
    expect(a.sodium_known).toBe(true);
    expect(a.sugar_known).toBe(false); // 1건 미상 → 전체 보류
  });

  it("값 누락(null)도 보류로 처리", () => {
    const recs: MealRecord[] = [
      { eaten_at: day(20), kcal: 2000, sodium_mg: null, sugar_g: 40, fiber_g: 20 },
    ];
    const a = aggregateMeals(recs);
    expect(a.sodium_known).toBe(false);
  });

  it("윈도우(7일) 밖 기록은 제외", () => {
    const recs: MealRecord[] = [
      { eaten_at: day(21), kcal: 2000, sodium_mg: 2400, sodium_known: true, sugar_g: 40, sugar_known: true, fiber_g: 20, fiber_known: true },
      { eaten_at: day(1), kcal: 9999, sodium_mg: 9999, sodium_known: true, sugar_g: 9999, sugar_known: true, fiber_g: 9999, fiber_known: true }, // 20일 전 → 제외
    ];
    const a = aggregateMeals(recs, 7);
    expect(a.days).toBe(1);
    expect(a.sodium_mg).toBe(2400);
  });

  it("집계 → dietToScores 연결: known true면 나트륨 신호 발화", () => {
    const recs: MealRecord[] = [
      { eaten_at: day(20), kcal: 2000, protein_g: 70, sodium_mg: 2400, sodium_known: true, sugar_g: 40, sugar_known: true, fiber_g: 20, fiber_known: true },
      { eaten_at: day(21), kcal: 2000, protein_g: 70, sodium_mg: 2400, sodium_known: true, sugar_g: 40, sugar_known: true, fiber_g: 20, fiber_known: true },
    ];
    const avg = aggregateMeals(recs);
    const r = dietToScores(avg, { sex: "male", weightKg: 70, kcalTarget: 2000, enableMicroSignals: true });
    expect(r.scores["심혈관"]).toBe(8); // 나트륨 2400 ≥ 2300, known
  });

  it("집계 → dietToScores 연결: known false면 나트륨 신호 보류", () => {
    const recs: MealRecord[] = [
      { eaten_at: day(20), kcal: 2000, protein_g: 70, sodium_mg: 2400, sodium_known: false, sugar_g: 40, sugar_known: true, fiber_g: 20, fiber_known: true },
      { eaten_at: day(21), kcal: 2000, protein_g: 70, sodium_mg: 2400, sodium_known: true, sugar_g: 40, sugar_known: true, fiber_g: 20, fiber_known: true },
    ];
    const avg = aggregateMeals(recs);
    const r = dietToScores(avg, { sex: "male", weightKg: 70, kcalTarget: 2000, enableMicroSignals: true });
    expect(r.scores["심혈관"]).toBeUndefined(); // 미상 전파 → 보류
  });
});
