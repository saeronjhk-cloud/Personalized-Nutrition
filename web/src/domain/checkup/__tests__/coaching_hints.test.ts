/** 검진↔코칭 연결 v1.1 — 서박사 회신 v2 ②③④ · K01~K16 · 정본 IP/integration/checkup_coaching_link_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CategoryResult } from "../engine";
import { observeKeysFor, shouldSuggestWeightGoal, CHECKUP_OBSERVE_NOTE, WEIGHT_GOAL_SUGGEST_TEXT, OBSERVE_KEYS } from "../coaching_hints";
import { goalMealCoaching, CARD_TEMPLATES, WEIGHT_CARD_TEMPLATES, type CoachingInput } from "../../coaching/goal_meal_coaching";
import { mealGrammarCoaching, GRAMMAR_SWAP_TEMPLATES, type GrammarMealRow, type MealGrammarInput } from "../../coaching/meal_grammar";

const R = (key: string, value: number, level: string, referral = false): CategoryResult => ({
  biomarker_key: key, value, level, label_ko: null, functional_needs: [], tone: null, force_medical_referral: referral, matched_range_id: null,
});

describe("② 관찰 안내", () => {
  it("K01 공복혈당 watch → 대상", () => { expect([...observeKeysFor([R("fasting_glucose", 110, "watch")])]).toEqual(["fasting_glucose"]); });
  it("K02 공복혈당 상담 권장 → 제외", () => { expect(observeKeysFor([R("fasting_glucose", 130, "high", true)]).size).toBe(0); });
  it("K03 같은 영역 두 항목 → 키 2개(화면은 영역당 1회 — 소스 K03b)", () => {
    expect(observeKeysFor([R("triglyceride", 170, "watch"), R("LDL", 140, "watch")]).size).toBe(2);
    const ui = readFileSync(resolve(__dirname, "../../../components/checkup/RecommendationList.tsx"), "utf-8");
    expect(ui).toContain("sec.items.some((it) => observe.has(it.key))");
    expect(ui.match(/CHECKUP_OBSERVE_NOTE/g)?.length).toBe(2); // import 1 + 렌더 1
  });
  it("K04 HDL watch(낮음 쪽) → 대상", () => { expect(observeKeysFor([R("HDL", 50, "watch")]).has("HDL")).toBe(true); });
  it("K05 혈색소·비타민D·BMI watch → 대상 아님", () => {
    expect(observeKeysFor([R("hemoglobin", 17, "watch"), R("vitamin_D", 25, "watch"), R("BMI", 27, "watch")]).size).toBe(0);
    expect(OBSERVE_KEYS.size).toBe(11);
  });
  it("K06 혈압 low(상담 아님) → 대상 아님", () => { expect(observeKeysFor([R("blood_pressure_systolic", 85, "low")]).size).toBe(0); });
  it("K07 문구 = 서박사 승인본", () => {
    expect(CHECKUP_OBSERVE_NOTE).toBe("식사 기록을 이어 가면 다음 검진 때 식습관 흐름을 함께 살펴볼 수 있어요. 재검 시기는 의료진과 상의해 주세요.");
  });
});

const U = (over: Partial<CoachingInput> = {}): CoachingInput => ({
  mealEnabled: true, loggedIn: true, goals: ["체중관리"], weightKg: 80, heightCm: 170, age: 45, conditions: [], egfr: null,
  meals: [{ slot: "lunch", protein_g: 25 }], ...over,
});
const NOW = new Date(2026, 9, 2, 20, 0, 0);
const row = (names: string[]): GrammarMealRow => { const d = new Date(NOW); d.setHours(12, 0, 0, 0); return { eaten_at: d.toISOString(), meal_slot: "lunch", foods: names.map((n) => ({ name_ko: n })) }; };
const GI = (over: Partial<MealGrammarInput> = {}): MealGrammarInput => ({
  mealEnabled: true, loggedIn: true, rows: [row(["쌀밥", "된장찌개", "시금치나물"])], now: NOW, conditions: [], egfr: null, v1CardVisible: false, ...over,
});

describe("③ 바꾸기형", () => {
  it("K08 체중관리 목표 카드 = 바꾸기형", () => {
    const c = goalMealCoaching(U()).cards[0];
    expect(c.goal).toBe("체중관리");
    expect(c.text).toBe(WEIGHT_CARD_TEMPLATES[c.level].replace("{slots}", "점심"));
    expect(c.text).toContain("바꿔 보세요");
    expect(c.text).not.toContain("더해 보세요");
  });
  it("K09 근육증가+체중관리 → 근육증가 더하기형(현행)", () => {
    const c = goalMealCoaching(U({ goals: ["체중관리", "근육증가"] })).cards[0];
    expect(c.goal).toBe("근육증가");
    expect(c.text).toBe(CARD_TEMPLATES[c.level].replace("{slots}", "점심"));
  });
  it("K10 G-PRO 바꾸기형 — 판정은 같고 문구만 다름", () => {
    const a = mealGrammarCoaching(GI()), b = mealGrammarCoaching(GI({ weightSwap: true }));
    expect(a.active?.rule).toBe("G-PRO"); expect(b.active?.rule).toBe("G-PRO");
    expect(b.active?.slots).toEqual(a.active?.slots);
    expect(b.active?.text).toBe(GRAMMAR_SWAP_TEMPLATES["G-PRO"]!.replace("{slots}", "점심"));
  });
  it("K11 목표 없음 → 더하기형(현행)", () => {
    expect(mealGrammarCoaching(GI({ weightSwap: false })).active?.text).toContain("더해 보세요");
  });
});

describe("④ 체중관리 목표 제안", () => {
  it("K12 BMI 27 · 체중관리 꺼짐 → 제안", () => { expect(shouldSuggestWeightGoal([R("BMI", 27, "watch")], ["근육증가"])).toBe(true); });
  it("K13 체중관리 켜짐 → 없음", () => { expect(shouldSuggestWeightGoal([R("BMI", 27, "watch")], ["체중관리"])).toBe(false); });
  it("K14 BMI 31 상담 권장 → 없음", () => { expect(shouldSuggestWeightGoal([R("BMI", 31, "high", true)], [])).toBe(false); });
  it("K15 BMI low·normal·없음·목표 미상 → 없음", () => {
    expect(shouldSuggestWeightGoal([R("BMI", 17, "low")], [])).toBe(false);
    expect(shouldSuggestWeightGoal([R("BMI", 23, "normal")], [])).toBe(false);
    expect(shouldSuggestWeightGoal([], [])).toBe(false);
    expect(shouldSuggestWeightGoal([R("BMI", 27, "watch")], null)).toBe(false);
  });
});

describe("K16 문구 금지어", () => {
  it("진단·치료·효능·감량·kcal 없음", () => {
    const all = [CHECKUP_OBSERVE_NOTE, WEIGHT_GOAL_SUGGEST_TEXT, ...Object.values(WEIGHT_CARD_TEMPLATES), GRAMMAR_SWAP_TEMPLATES["G-PRO"]!].join("\n");
    expect(all).not.toMatch(/진단|치료|효능|효과|감량|kcal|칼로리|빠집|개선/);
  });
});

describe("W01~W04 코칭 문구 v2 (말투 권유형 통일 · 50_문구확인_회신_및_말투결정.md)", () => {
  it("W01 9종 글자 일치", async () => {
    const { CARD_TEMPLATES: C, WEIGHT_CARD_TEMPLATES: W } = await import("../../coaching/goal_meal_coaching");
    const { GRAMMAR_TEMPLATES: G, GRAMMAR_SWAP_TEMPLATES: S } = await import("../../coaching/meal_grammar");
    expect(C.normal).toBe("오늘 {slots} 단백질이 목표보다 조금 적었어요. 다음 끼니에 달걀이나 두부 한 가지를 더해 보세요.");
    expect(C.strong).toBe("오늘 {slots} 단백질이 목표보다 많이 적었어요. 다음 끼니에 살코기·생선·두부 중 한 가지를 손바닥 크기로 더해 보세요.");
    expect(W.normal).toBe("오늘 {slots} 단백질이 목표보다 조금 적었어요. 다음 끼니에는 반찬 하나를 달걀이나 두부로 바꿔 보세요.");
    expect(W.strong).toBe("오늘 {slots} 단백질이 목표보다 많이 적었어요. 다음 끼니에는 반찬 하나를 살코기·생선·두부 중 한 가지로 바꿔 보세요.");
    expect(G["G-PRO"]).toBe("오늘 {slots}에는 단백질 반찬이 없었어요. 다음 끼니에 달걀이나 두부 한 가지를 더해 보세요.");
    expect(S["G-PRO"]).toBe("오늘 {slots}에는 단백질 반찬이 없었어요. 다음 끼니에는 반찬 하나를 달걀이나 두부로 바꿔 보세요.");
    expect(G["G-VEG"]).toBe("오늘 {slots}에는 김치 말고 채소 반찬이 없었어요. 다음 끼니에 나물이나 쌈 한 가지를 더해 보세요.");
    expect(G["G-AM"]).toBe("오늘 아침에는 단백질 반찬이 없었어요. 내일 아침은 우유나 달걀 하나부터 시작해 보세요.");
    expect(WEIGHT_GOAL_SUGGEST_TEXT).toBe("체중관리 목표를 켜면 식사 기록에 맞춰 반찬 하나를 단백질 반찬으로 바꾸는 방법을 제안해 드려요.");
  });
  it("W02 카드 문구 끝 = «보세요.» · 평서형·명령형 0", async () => {
    const { CARD_TEMPLATES: C, WEIGHT_CARD_TEMPLATES: W } = await import("../../coaching/goal_meal_coaching");
    const { GRAMMAR_TEMPLATES: G, GRAMMAR_SWAP_TEMPLATES: S } = await import("../../coaching/meal_grammar");
    for (const t of [...Object.values(C), ...Object.values(W), ...Object.values(G), ...Object.values(S) as string[]]) {
      expect(t).toMatch(/보세요\.$/);
      expect(t).not.toMatch(/습니다\.|합니다\.|하세요\.|하십시오|해야 합니다/);
    }
  });
});
