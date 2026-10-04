/**
 * 한식 끼니 문법 P1 — 배선 구조 가드 (W1~W4) · 정본 IP/integration/meal_grammar_p1_eval_v1.md
 * 렌더 테스트 대신 소스 검사(Meal_goal_coaching_wiring 패턴).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const meal = read("../Meal.tsx");
const coach = read("../../components/CoachCards.tsx");
const card = read("../../components/MealGrammarCard.tsx");
const loader = read("../../lib/mealGrammar.ts");
const flags = read("../../lib/flags.ts");
const grammar = read("../../domain/coaching/meal_grammar.ts");
const role = read("../../domain/coaching/meal_role.ts");

describe("한식 끼니 문법 P1 — /meal 배선", () => {
  it("W1 플래그 게이트: 기본 false · Meal.tsx 는 플래그로만 렌더(1곳)", () => {
    expect(flags).toContain("export const MEAL_GRAMMAR_ENABLED = import.meta.env.VITE_MEAL_GRAMMAR_ENABLED === 'true'");
    expect(coach).toContain("MEAL_GRAMMAR_ENABLED && <MealGrammarCard />");
    expect(coach.match(/<MealGrammarCard/g)).toHaveLength(1);
    expect(meal).not.toContain("<MealGrammarCard");
  });
  it("W2 카드는 mealGrammarCoaching 결과만 그림 · 이름 해석·문구 생성 0", () => {
    expect(card).toContain("mealGrammarCoaching(");
    expect(card).not.toMatch(/resolveRoles|GRAMMAR_TEMPLATES|PROTEIN|RICE|\.replace\(/);
  });
  it("W3 순수 모듈은 IO import 0 · 로더는 foods·meal_slot 조회 + 안전 입력 재사용", () => {
    for (const src of [grammar, role]) {
      expect(src).not.toMatch(/from ['"].*(supabase|lib\/)/);
      expect(src).not.toContain("fetch(");
    }
    expect(loader).toContain("'eaten_at, meal_slot, foods'");
    expect(loader).toContain("loadGoalCoachingInput()");
    expect(loader).toContain("mealEnabled: MEAL_ENABLED");
  });
  it("W4 카드 화면 문구 금지어 0", () => {
    for (const w of ["줄이", "덜 드세요", "금지", "kg", "체중", "칼로리", "kcal", "질환", "위험", "감량"]) expect(card).not.toContain(w);
  });
});
