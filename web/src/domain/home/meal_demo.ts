/**
 * 홈 P1 — 10초 밥상 데모 (순수 · 결정론 · 원칙5)
 * 예시 밥상을 «실제 엔진»(resolveRoles·judgeMeal·mealGrammarCoaching)으로 계산해 화면에 넘긴다 — 하드코딩 0.
 * 사전·승인 문구가 바뀌면 데모도 같이 바뀌고, 기대와 어긋나면 평가(D01~D03)가 깨진다.
 * 평가: IP/integration/home_demo_eval_v1.md · ⚠ IO import 금지
 */
import { resolveRoles, type Role } from "../coaching/meal_role";
import { judgeMeal, mealGrammarCoaching } from "../coaching/meal_grammar";
import type { GrammarRuleId } from "../coaching/meal_grammar_params";

export interface DemoFood { name: string; emoji: string }
export const DEMO_FOODS: readonly DemoFood[] = [
  { name: "잡곡밥", emoji: "🍚" },
  { name: "미역국", emoji: "🥣" },
  { name: "배추김치", emoji: "🥬" },
  { name: "시금치나물", emoji: "🌿" },
];

/** 재생 타임라인(ms, 화면 진입 기준) — D10: 마지막 ≤ 10000 */
export const DEMO_TIMELINE_MS = { foods: 0, roles: 1500, checks: 4500, card: 7000 } as const;

const ROLE_LABEL: Partial<Record<Role, string>> = {
  RICE: "주식", NOODLE: "주식", GRAIN_OTHER: "주식", BROTH: "국", KIMCHI: "김치", PICKLE: "장아찌", VEG: "채소 반찬", PROTEIN: "단백질 반찬",
};

export interface MealDemo {
  foods: { name: string; emoji: string; roleLabel: string }[];
  checks: { label: string; ok: boolean }[];
  card: { rule: GrammarRuleId; text: string } | null;
}

export function mealDemo(): MealDemo {
  const names = DEMO_FOODS.map((f) => f.name);
  const foods = DEMO_FOODS.map((f) => ({ ...f, roleLabel: ROLE_LABEL[resolveRoles(f.name)[0]] ?? "기타" }));
  const judged = judgeMeal({ day: "demo", slot: "lunch", names });
  const checks = [
    { label: "주식", ok: judged.staple === true },
    { label: "채소 반찬", ok: judged.veg === true },
    { label: "단백질 반찬", ok: judged.protein === true },
  ];
  const now = new Date(2026, 0, 1, 13, 0, 0);
  const eaten = new Date(2026, 0, 1, 12, 0, 0).toISOString();
  const res = mealGrammarCoaching({
    mealEnabled: true, loggedIn: true, now, conditions: [], egfr: null, v1CardVisible: false,
    rows: [{ eaten_at: eaten, meal_slot: "lunch", foods: names.map((n) => ({ name_ko: n })) }],
  });
  return { foods, checks, card: res.active ? { rule: res.active.rule, text: res.active.text } : null };
}
