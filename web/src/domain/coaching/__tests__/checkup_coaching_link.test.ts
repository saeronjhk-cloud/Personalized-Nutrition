/**
 * 검진↔코칭 연결 v1 — 요단백 안전 차단 L01~L18 (Eval-First)
 * 정본: IP/integration/checkup_coaching_link_eval_v1.md · 근거: checkup_coaching_link_v1/10_R1_교차확인_종합.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { mealGrammarCoaching, todayCoachNotice, type GrammarMealRow, type MealGrammarInput } from "../meal_grammar";
import { goalMealCoaching, type CoachingInput } from "../goal_meal_coaching";
import { DEFAULT_GOAL_COACHING_PARAMS as P, kidneyBlockReason } from "../goal_coaching_params";

const NOW = new Date(2026, 9, 2, 20, 0, 0);
const at = (h: number) => { const d = new Date(NOW); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const HOUR: Record<string, number> = { breakfast: 8, lunch: 12, dinner: 18 };
const row = (slot: string, names: string[]): GrammarMealRow => ({ eaten_at: at(HOUR[slot]), meal_slot: slot, foods: names.map((n) => ({ name_ko: n })) });
const IN = (rows: GrammarMealRow[], over: Partial<MealGrammarInput> = {}): MealGrammarInput => ({
  mealEnabled: true, loggedIn: true, rows, now: NOW, conditions: [], egfr: null, v1CardVisible: false, ...over,
});
const NO_PROTEIN_LUNCH = [row("lunch", ["쌀밥", "된장찌개", "시금치나물"])];
const NO_PROTEIN_NO_VEG = [row("lunch", ["쌀밥", "김치찌개", "배추김치"])];
const U70 = (over: Partial<CoachingInput> = {}): CoachingInput => ({
  mealEnabled: true, loggedIn: true, goals: ["근육증가"], weightKg: 70, heightCm: 175, age: 40,
  conditions: [], egfr: null, meals: [{ slot: "breakfast", protein_g: 10 }, { slot: "lunch", protein_g: 10 }, { slot: "dinner", protein_g: 10 }], ...over,
});

describe("검진↔코칭 연결 — 요단백 안전 차단", () => {
  it("L01 요단백 음성 → G-PRO 활성(현행)", () => {
    const r = mealGrammarCoaching(IN(NO_PROTEIN_LUNCH, { urineProtein: 0, egfr: 90 }));
    expect(r.active?.rule).toBe("G-PRO");
    expect(r.blocked_reason).toBeNull();
  });
  it("L02 요단백 양성(+1) → 단백질 규칙 없음 · urine_protein · 채소 규칙은 유지", () => {
    const r = mealGrammarCoaching(IN(NO_PROTEIN_LUNCH, { urineProtein: 1, egfr: 90 }));
    expect(r.active).toBeNull();
    expect(r.blocked_reason).toBe("urine_protein");
    const v = mealGrammarCoaching(IN(NO_PROTEIN_NO_VEG, { urineProtein: 1 }));
    expect(v.active?.rule).toBe("G-VEG");
    expect(v.blocked_reason).toBe("urine_protein");
  });
  it("L03 약양성(0.5) → 차단 없음(R1 합의 (가))", () => {
    const r = mealGrammarCoaching(IN(NO_PROTEIN_LUNCH, { urineProtein: 0.5 }));
    expect(r.active?.rule).toBe("G-PRO");
    expect(r.blocked_reason).toBeNull();
  });
  it("L04 요단백 없음(null·미지정) → 현행", () => {
    expect(mealGrammarCoaching(IN(NO_PROTEIN_LUNCH, { urineProtein: null })).active?.rule).toBe("G-PRO");
    expect(mealGrammarCoaching(IN(NO_PROTEIN_LUNCH)).active?.rule).toBe("G-PRO");
    expect(kidneyBlockReason({ conditions: [], egfr: null, urineProtein: Number.NaN })).toBeNull();
  });
  it("L05 eGFR 55 · 요단백 음성 → egfr_low(회귀, 순서 eGFR 먼저)", () => {
    expect(mealGrammarCoaching(IN(NO_PROTEIN_LUNCH, { egfr: 55, urineProtein: 0 })).blocked_reason).toBe("egfr_low");
    expect(kidneyBlockReason({ conditions: [], egfr: 55, urineProtein: 3 })).toBe("egfr_low");
  });
  it("L12 신장질환 → kidney_condition(회귀, 가장 먼저)", () => {
    expect(kidneyBlockReason({ conditions: ["신장질환"], egfr: 55, urineProtein: 3 })).toBe("kidney_condition");
  });
  it("L14 근육증가 목표 카드도 요단백 양성이면 없음(목표 카드보다 신장 차단 먼저)", () => {
    expect(goalMealCoaching(U70()).cards.length).toBeGreaterThan(0);
    const r = goalMealCoaching(U70({ urineProtein: 2 }));
    expect(r.cards).toEqual([]);
    expect(r.blocked_reason).toBe("urine_protein");
    const w = goalMealCoaching(U70({ goals: ["체중관리"], urineProtein: 1 }));
    expect(w.cards).toEqual([]);
    expect(w.blocked_reason).toBe("urine_protein");
  });
  it("L15 양성 +4 → 차단", () => {
    expect(kidneyBlockReason({ conditions: [], egfr: 90, urineProtein: 4 })).toBe("urine_protein");
  });
  it("L16 오늘 안내 — 요단백 양성이면 단백질 규칙 빼고 판정(eGFR 차단과 같은 동작)", () => {
    const rows = [row("breakfast", ["닭가슴살"])];
    const a = todayCoachNotice(IN(rows, { urineProtein: 1 }));
    const b = todayCoachNotice(IN(rows, { conditions: ["신장질환"] }));
    expect(a).toEqual(b);
  });
  it("L17 값은 params 한 곳 · 화면에 차단 사유 문구 없음", () => {
    expect(P.URINE_PROTEIN_BLOCK).toBe(1);
    const root = resolve(__dirname, "../../..");
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === "__tests__" ? [] : walk(join(d, e.name))) : e.name.endsWith(".tsx") ? [join(d, e.name)] : []);
    for (const f of walk(root)) expect(readFileSync(f, "utf-8")).not.toMatch(/blocked_reason/);
  });
});
