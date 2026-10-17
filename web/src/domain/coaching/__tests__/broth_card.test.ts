/** 국물 카드 v1 — IP/integration/broth_card_v1/00_설계·평가셋_v1.md B01~B12 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brothCard, mealGrammarCoaching, BROTH_TEMPLATE, BROTH_WHY, type GrammarMealRow, type MealGrammarInput } from "../meal_grammar";
import { BANNED_WORDS } from "../../checkup/compliance";

const NOW = new Date(2026, 9, 17, 21, 0, 0);
const HOUR: Record<string, number> = { breakfast: 8, lunch: 12, dinner: 18, snack: 15 };
const row = (slot: string, names: string[], daysAgo = 0): GrammarMealRow => {
  const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(HOUR[slot], 0, 0, 0);
  return { eaten_at: d.toISOString(), meal_slot: slot, foods: names.map((n) => ({ name_ko: n })) };
};
const IN = (rows: GrammarMealRow[], over: Partial<MealGrammarInput> = {}): MealGrammarInput => ({
  mealEnabled: true, loggedIn: true, rows, now: NOW, conditions: [], egfr: null, v1CardVisible: false, ...over,
});

describe("B 국물 카드", () => {
  it("B01 1회 → 없음", () => expect(brothCard(IN([row("lunch", ["쌀밥", "김치찌개"])]))).toBeNull());
  it("B02 찌개 + 라면 → 2번", () => {
    const c = brothCard(IN([row("lunch", ["쌀밥", "김치찌개"]), row("dinner", ["라면"])]));
    expect(c?.count).toBe(2);
    expect(c?.text).toBe("오늘 국물·면 요리를 2번 드셨어요. 국은 건더기 위주로 드시고, 국물은 반쯤 남겨 보세요.");
  });
  it("B03 같은 끼니 찌개+국 = 1회", () => expect(brothCard(IN([row("lunch", ["쌀밥", "김치찌개", "미역국"])]))).toBeNull());
  it("B04 3번", () => expect(brothCard(IN([row("breakfast", ["떡국"]), row("lunch", ["칼국수"]), row("dinner", ["쌀밥", "된장찌개"])]))?.count).toBe(3));
  it("B05 어제 2회·오늘 0회 → 없음", () =>
    expect(brothCard(IN([row("lunch", ["라면"], 1), row("dinner", ["김치찌개"], 1), row("lunch", ["쌀밥", "제육볶음"])]))).toBeNull());
  it("B06 간식 포함", () => expect(brothCard(IN([row("snack", ["라면"]), row("lunch", ["순대국밥"])]))?.count).toBe(2));
  it("B07 P1 활성 카드가 있는 날은 숨김(호출부 규칙 — 화면이 active 없을 때만 그림)", () => {
    const input = IN([row("lunch", ["쌀밥", "김치찌개"]), row("dinner", ["라면"])]);
    expect(mealGrammarCoaching(input).active?.rule).toBe("G-PRO");
    const src = readFileSync(resolve(__dirname, "../../../components/MealGrammarCard.tsx"), "utf-8");
    expect(src).toMatch(/r\.active \? null : brothCard\(input\)/);
  });
  it("B08 신장 안전 차단이어도 표시", () =>
    expect(brothCard(IN([row("lunch", ["쌀밥", "계란국"]), row("dinner", ["설렁탕"])], { urineProtein: 1 }))?.count).toBe(2));
  it("B09 볶음밥·비빔밥만 → 없음", () => expect(brothCard(IN([row("lunch", ["김치볶음밥"]), row("dinner", ["비빔밥"])]))).toBeNull());
  it("B10 문구 금지어·강한 금지 표현 0", () => {
    for (const t of [BROTH_TEMPLATE, BROTH_WHY]) for (const w of [...BANNED_WORDS, "먹지 마", "줄이세요", "드시지 마"]) expect(t).not.toContain(w);
    expect(BROTH_TEMPLATE.endsWith("보세요.")).toBe(true);
  });
  it("B11 화면은 결과만 렌더", () => {
    const src = readFileSync(resolve(__dirname, "../../../components/MealGrammarCard.tsx"), "utf-8");
    expect(src).toContain('data-testid="broth-card"');
    expect(src).not.toContain("국물은 반쯤");
  });
});
