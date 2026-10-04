/**
 * 목표 기반 식사 코칭 v1 — 배선 구조 가드 (평가셋 보조: 플래그 OFF → 렌더 0)
 * 렌더 테스트 대신 소스 검사(Dashboard_diet_wiring 패턴).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const meal = read("../Meal.tsx");
const coach = read("../../components/CoachCards.tsx");
const card = read("../../components/GoalCoachingCard.tsx");
const loader = read("../../lib/goalCoaching.ts");
const flags = read("../../lib/flags.ts");

describe("목표 식사 코칭 — /meal 배선", () => {
  it("W1 플래그 게이트: GOAL_COACHING_ENABLED 기본 false(=== 'true') · Meal.tsx 는 플래그로만 렌더", () => {
    expect(flags).toContain("export const GOAL_COACHING_ENABLED = import.meta.env.VITE_GOAL_COACHING_ENABLED === 'true'");
    // 2026-10-04: 카드 묶음 CoachCards 로 이동(첫 화면·저장 직후·홈 공용) — coach_card_placement_eval_v1
    expect(coach).toContain("GOAL_COACHING_ENABLED && <GoalCoachingCard />");
    expect(coach.match(/<GoalCoachingCard/g)).toHaveLength(1);
    expect(meal).not.toContain("<GoalCoachingCard");
  });

  it("W2 판정은 goalMealCoaching() 한 곳 · 카드가 숫자를 새로 만들지 않음", () => {
    expect(card).toContain("goalMealCoaching(");
    expect(card).not.toMatch(/PER_MEAL_G_PER_KG|SHORT_NORMAL|SHORT_STRONG|\* ?0\.4/);
  });

  it("W3 로더: 실섭취 우선 규칙 공유(mealRowsToCoachMeals) · meal_slot·adjusted_summary 조회 · MEAL 플래그 전달", () => {
    expect(loader).toContain("mealRowsToCoachMeals(");
    expect(loader).toContain("'eaten_at, meal_slot, summary, adjusted_summary, foods'");
    expect(loader).toContain("proteinRoleBySlot(");
    expect(loader).toContain("mealEnabled: MEAL_ENABLED");
  });

  it("W4 카드 화면 문구 금지어 0", () => {
    for (const w of ["덜 드세요", "줄이", "금지", "kg", "체중", "질환", "위험"]) expect(card).not.toContain(w);
  });
});
