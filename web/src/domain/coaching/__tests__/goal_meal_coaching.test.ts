/**
 * 목표 기반 식사 코칭 평가셋 v1 (C01~C22 + 보조) — Eval-First
 * 정본: IP/integration/goal_meal_coaching_eval_v1.md · 설계: IP/integration/goal_meal_coaching_design_v1.md
 * 기대 숫자는 파라미터 기본값 기준. 서박사 확정으로 값이 바뀌면 «기대 숫자만» 갱신(케이스 삭제 금지).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  goalMealCoaching,
  mealRowsToCoachMeals,
  GOAL_TO_P0,
  p0GoalsFor,
  CARD_TEMPLATES,
  type CoachingInput,
  type CoachMeal,
  type CoachMealRow,
} from "../goal_meal_coaching";
import { DEFAULT_GOAL_COACHING_PARAMS as P } from "../goal_coaching_params";
import { GOAL_OPTIONS } from "../../goals/goals";
import { proteinRoleBySlot } from "../meal_grammar";

const B = (protein_g: number | null): CoachMeal => ({ slot: "breakfast", protein_g });
const L = (protein_g: number | null): CoachMeal => ({ slot: "lunch", protein_g });
const D = (protein_g: number | null): CoachMeal => ({ slot: "dinner", protein_g });

/** U70 = 근육증가 · 70 kg · 40세 · 기저질환 없음 · egfr null → 끼니목표 28 g */
function U70(over: Partial<CoachingInput> = {}): CoachingInput {
  return {
    mealEnabled: true,
    loggedIn: true,
    goals: ["근육증가"],
    weightKg: 70,
    heightCm: 175,
    age: 40,
    conditions: [],
    egfr: null,
    meals: [],
    ...over,
  };
}
const LOW3 = [B(10), L(10), D(10)];

describe("목표 식사 코칭 v1 — 평가셋 C01~C22", () => {
  afterEach(() => vi.restoreAllMocks());

  it("C01 목표 없음 → 카드 0", () => {
    expect(goalMealCoaching(U70({ goals: [], meals: LOW3 })).cards).toHaveLength(0);
  });

  it("C02 대응표 ⛔ 목표(수면개선·눈건강) → 카드 0", () => {
    expect(goalMealCoaching(U70({ goals: ["수면개선", "눈건강"], meals: LOW3 })).cards).toHaveLength(0);
  });

  it("C03 아침 20 g·점심 30 g·저녁 미기록 → 카드 1 · breakfast normal", () => {
    const r = goalMealCoaching(U70({ meals: [B(20), L(30)] }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].reason_code).toBe("NL_LOW_PROTEIN_MEAL");
    expect(r.cards[0].meals).toEqual([{ slot: "breakfast", protein_g: 20, target_g: 28, level: "normal" }]);
  });

  it("C04 아침 15 g → strong", () => {
    const r = goalMealCoaching(U70({ meals: [B(15)] }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].meals[0].level).toBe("strong");
  });

  it("C04b 아침 16.8 g (strong 경계, 부동소수 16.7999…) → strong", () => {
    expect(goalMealCoaching(U70({ meals: [B(16.8)] })).cards[0].meals[0].level).toBe("strong");
  });

  it("C05 아침 22.4 g (부족률 정확히 0.20) → normal", () => {
    const r = goalMealCoaching(U70({ meals: [B(22.4)] }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].meals[0].level).toBe("normal");
  });

  it("C06 아침 22.5 g·점심 28 g → 카드 0", () => {
    expect(goalMealCoaching(U70({ meals: [B(22.5), L(28)] })).cards).toHaveLength(0);
  });

  it("C07 세 끼 모두 부족 → 카드 «1장» · meals 3개(아침→점심→저녁)", () => {
    const r = goalMealCoaching(U70({ meals: [D(14), B(10), L(12)] }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].meals.map((m) => m.slot)).toEqual(["breakfast", "lunch", "dinner"]);
  });

  it("C08 기저질환 신장질환 → 카드 0 · blocked_reason kidney_condition", () => {
    const r = goalMealCoaching(U70({ conditions: ["신장질환"], meals: LOW3 }));
    expect(r.cards).toHaveLength(0);
    expect(r.blocked_reason).toBe("kidney_condition");
  });

  it("C09 egfr 55 → 카드 0 · blocked_reason egfr_low", () => {
    const r = goalMealCoaching(U70({ egfr: 55, meals: LOW3 }));
    expect(r.cards).toHaveLength(0);
    expect(r.blocked_reason).toBe("egfr_low");
  });

  it("C10 egfr 60(경계) → 통과 · 카드 1", () => {
    expect(goalMealCoaching(U70({ egfr: 60, meals: [B(10)] })).cards).toHaveLength(1);
  });

  it("C11 체중 없음 → 카드 0 (목표를 지어내지 않음)", () => {
    expect(goalMealCoaching(U70({ weightKg: null, meals: LOW3 })).cards).toHaveLength(0);
  });

  it("C12 아침 미상(null)·점심 10 g → meals=[lunch] 만", () => {
    const r = goalMealCoaching(U70({ meals: [B(null), L(10)] }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].meals.map((m) => m.slot)).toEqual(["lunch"]);
  });

  it("C13 간식 5 g 만 → 카드 0", () => {
    expect(goalMealCoaching(U70({ meals: [{ slot: "snack", protein_g: 5 }] })).cards).toHaveLength(0);
  });

  it("C14 adjusted_summary 25 g / summary 12 g → 25 g 로 판정 → 카드 0", () => {
    const rows: CoachMealRow[] = [
      { eaten_at: "2026-09-30T03:00:00Z", meal_slot: "lunch", summary: { total_protein_g: 12 }, adjusted_summary: { total_protein_g: 25 } },
    ];
    const meals = mealRowsToCoachMeals(rows);
    expect(meals).toEqual([{ slot: "lunch", protein_g: 25 }]);
    expect(goalMealCoaching(U70({ meals })).cards).toHaveLength(0);
  });

  it("C15 체중관리 단독 · 저단백 → WEIGHT_PROTEIN_CARD=false 면 카드 0 · 기본값(true, 서박사 D5 승인)이면 단백질 카드만 · 열량 카드는 어떤 경우에도 0", () => {
    const meals: CoachMeal[] = [
      { slot: "breakfast", protein_g: 10, kcal: 1200 },
      { slot: "lunch", protein_g: 10, kcal: 1500 },
    ];
    const r = goalMealCoaching(U70({ goals: ["체중관리"], meals, params: { ...P, WEIGHT_PROTEIN_CARD: false } }));
    expect(r.cards).toHaveLength(0);
    const rD = goalMealCoaching(U70({ goals: ["체중관리"], meals }));
    expect(rD.cards.length).toBeGreaterThan(0);
    expect(rD.cards.every((c) => c.reason_code === "NL_LOW_PROTEIN_MEAL")).toBe(true);
    // G2=(B) 채택 시에도 단백질 카드뿐 — 열량 카드 없음
    const rB = goalMealCoaching(U70({ goals: ["체중관리"], meals, params: { ...P, WEIGHT_PROTEIN_CARD: true } }));
    expect(rB.cards.every((c) => c.reason_code === "NL_LOW_PROTEIN_MEAL")).toBe(true);
  });

  it("C16 체중관리 + BMI 17.9 → 카드 0 (WEIGHT_PROTEIN_CARD 켜져도)", () => {
    // 175 cm · 54.8 kg → BMI 17.89
    const inp = U70({ goals: ["체중관리"], weightKg: 54.8, heightCm: 175, meals: LOW3 });
    expect(goalMealCoaching(inp).cards).toHaveLength(0);
    const r = goalMealCoaching({ ...inp, params: { ...P, WEIGHT_PROTEIN_CARD: true } });
    expect(r.cards).toHaveLength(0);
    expect(r.blocked_reason).toBe("underweight");
  });

  it("C17 심혈관건강 · 7일 나트륨 3500 mg · sodium_known=false → 카드 0", () => {
    const r = goalMealCoaching(U70({ goals: ["심혈관건강"], sodium7d: { avg_mg: 3500, known: false }, meals: LOW3 }));
    expect(r.cards).toHaveLength(0);
    // 데이터 가드 설계 전에는 known=true 여도 v1 은 나트륨 카드 없음(SODIUM_COACHING=false)
    const r2 = goalMealCoaching(U70({ goals: ["심혈관건강"], sodium7d: { avg_mg: 3500, known: true }, meals: LOW3 }));
    expect(r2.cards).toHaveLength(0);
  });

  it("C18 혈당관리 · 고탄수 저녁 → 카드 0 (GI/GL 동결)", () => {
    const r = goalMealCoaching(U70({ goals: ["혈당관리"], meals: [{ slot: "dinner", protein_g: 10, carbs_g: 150 }] }));
    expect(r.cards).toHaveLength(0);
  });

  it("C19 [근육증가, 심혈관건강, 혈당관리] · 저단백 → 카드 1 (단백질만)", () => {
    const r = goalMealCoaching(U70({ goals: ["근육증가", "심혈관건강", "혈당관리"], meals: LOW3 }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].reason_code).toBe("NL_LOW_PROTEIN_MEAL");
  });

  it("C20 결정론 · 외부 호출 0", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const inp = U70({ meals: [B(15), L(20)] });
    const a = goalMealCoaching(inp);
    const b = goalMealCoaching(inp);
    expect(a).toEqual(b);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    // 순수 모듈: IO·AI 의존 import 없음
    const src = readFileSync(resolve(__dirname, "../goal_meal_coaching.ts"), "utf-8");
    expect(src).not.toMatch(/from ["'][^"']*(supabase|nutrilens|openai|fetch)/i);
  });

  it("C21 GOAL_TO_P0 = 설계 §1 대응표 · 키 = GOAL_OPTIONS id", () => {
    const DESIGN_TABLE_V1: Record<string, string[]> = {
      근육증가: ["muscle"],
      체중관리: ["weight"],
      심혈관건강: ["cardio"],
      혈당관리: ["glucose"],
      간건강: [],
      피로회복: ["recovery"],
      수면개선: ["recovery"],
      면역력강화: [],
      소화장건강: [],
      피부개선: [],
      눈건강: [],
      갱년기관리: [],
      인지력향상: [],
    };
    expect(Object.keys(GOAL_TO_P0).sort()).toEqual(GOAL_OPTIONS.map((g) => g.id).sort());
    expect(GOAL_TO_P0).toEqual(DESIGN_TABLE_V1);
    // 규칙2: hypertension 은 목표가 아니라 기저질환 «고혈압» 에서 부가
    expect(p0GoalsFor(["심혈관건강"], ["고혈압"])).toEqual(["cardio", "hypertension"]);
    expect(p0GoalsFor([], ["고혈압"])).toEqual(["hypertension"]);
    expect(p0GoalsFor(["수면개선", "피로회복"], [])).toEqual(["recovery"]);
  });

  it("C22 카드 문구 — 금지어 0 · 존대 평서형", () => {
    const FORBIDDEN = ["덜 드세요", "줄이", "금지", "kg", "체중", "질환", "위험"];
    const texts: string[] = [...Object.values(CARD_TEMPLATES)];
    for (const meals of [[B(20)], [B(10)], [B(10), L(20)], LOW3]) {
      const c = goalMealCoaching(U70({ meals })).cards[0];
      texts.push(c.text);
    }
    for (const t of texts) {
      for (const w of FORBIDDEN) expect(t, `«${w}» in «${t}»`).not.toContain(w);
      expect(t.trim()).toMatch(/(습니다|합니다)\.?$/);
    }
  });
});

describe("목표 식사 코칭 v1 — 보조", () => {
  it("노년 보정: 70세 50 kg → 끼니목표 max(20, 25)=25 g · 아침 18 g → normal", () => {
    const r = goalMealCoaching(U70({ age: 70, weightKg: 50, heightCm: 160, meals: [B(18)] }));
    expect(r.cards[0].meals[0]).toEqual({ slot: "breakfast", protein_g: 18, target_g: 25, level: "normal" });
    // 보정 끔(E2 불채택) → 목표 20 g · 18 g 은 부족률 0.1 → 카드 0
    expect(goalMealCoaching(U70({ age: 70, weightKg: 50, heightCm: 160, meals: [B(18)], params: { ...P, ELDERLY_MIN_G: null } })).cards).toHaveLength(0);
  });

  it("MEAL_ENABLED=false / 비로그인 → 카드 0", () => {
    expect(goalMealCoaching(U70({ mealEnabled: false, meals: LOW3 })).cards).toHaveLength(0);
    expect(goalMealCoaching(U70({ loggedIn: false, meals: LOW3 })).cards).toHaveLength(0);
  });

  it("S1 같은 끼니 여러 접시(정찬) → 합산해 판정", () => {
    const rows: CoachMealRow[] = [
      { eaten_at: "2026-09-30T03:00:00Z", meal_slot: "lunch", summary: { total_protein_g: 12 } },
      { eaten_at: "2026-09-30T03:10:00Z", meal_slot: "lunch", summary: { total_protein_g: 14 } },
    ];
    expect(mealRowsToCoachMeals(rows)).toEqual([{ slot: "lunch", protein_g: 26 }]);
  });

  it("S2 같은 끼니 중 한 접시라도 단백질 미상 → 그 끼니는 미상(null, 판정 제외)", () => {
    const rows: CoachMealRow[] = [
      { eaten_at: "2026-09-30T03:00:00Z", meal_slot: "lunch", summary: { total_protein_g: 5 } },
      { eaten_at: "2026-09-30T03:10:00Z", meal_slot: "lunch", summary: { total_protein_g: null } },
    ];
    const meals = mealRowsToCoachMeals(rows);
    expect(meals).toEqual([{ slot: "lunch", protein_g: null }]);
    expect(goalMealCoaching(U70({ meals })).cards).toHaveLength(0);
  });

  it("S3 meal_slot 없는 행 → 판정 제외", () => {
    const rows: CoachMealRow[] = [{ eaten_at: "2026-09-30T03:00:00Z", meal_slot: null, summary: { total_protein_g: 3 } }];
    expect(goalMealCoaching(U70({ meals: mealRowsToCoachMeals(rows) })).cards).toHaveLength(0);
  });

  it("S4 파라미터 기본값 = 설계 §4 표", () => {
    expect(P).toMatchObject({
      PER_MEAL_G_PER_KG: 0.4, ELDERLY_MIN_G: 25, ELDERLY_AGE: 65, SHORT_NORMAL: 0.2, SHORT_STRONG: 0.4,
      EGFR_BLOCK: 60, WEIGHT_PROTEIN_CARD: true, UNDERWEIGHT_BMI: 18.5, SODIUM_COACHING: false,
    });
    expect(P.EXCLUDE_CONDITIONS).toEqual(["신장질환"]);
  });

  it("S5 체중관리 + G2=(B) + BMI 정상 → 단백질 카드 1 (goal=체중관리)", () => {
    const r = goalMealCoaching(U70({ goals: ["체중관리"], meals: LOW3, params: { ...P, WEIGHT_PROTEIN_CARD: true } }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].goal).toBe("체중관리");
  });
});

describe("v2 단백질 주 판정 = G-PRO (C23~C29 · IP/integration/goal_meal_coaching_eval_v1.md v2)", () => {
  it("C23 반찬 있음 → 카드 0", () =>
    expect(goalMealCoaching(U70({ meals: [B(5)], proteinRoleBySlot: { breakfast: true } })).cards).toHaveLength(0));
  it("C24 반찬 없음 → 카드 1 strong", () => {
    const r = goalMealCoaching(U70({ meals: [B(5)], proteinRoleBySlot: { breakfast: false } }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].level).toBe("strong");
  });
  it("C25 미상 → 카드 0", () =>
    expect(goalMealCoaching(U70({ meals: [B(5)], proteinRoleBySlot: { breakfast: null } })).cards).toHaveLength(0));
  it("C26 아침 있음·점심 없음 → 점심만", () => {
    const r = goalMealCoaching(U70({ meals: [B(10), L(10)], proteinRoleBySlot: { breakfast: true, lunch: false } }));
    expect(r.cards[0].meals.map((m) => m.slot)).toEqual(["lunch"]);
    expect(r.cards[0].text.startsWith("오늘 점심 ")).toBe(true);
  });
  it("C27 맵 없음 → 종전 동작", () =>
    expect(goalMealCoaching(U70({ meals: [B(10)] })).cards).toHaveLength(1));
  it("C28 맵에 키 없음 → 미상 → 제외", () =>
    expect(goalMealCoaching(U70({ meals: [B(10), L(30)], proteinRoleBySlot: { lunch: false } })).cards).toHaveLength(0));
  it("C29 통합 실례: 참치 샐러드 점심 0 · 피자 저녁 1", () => {
    const now = new Date(2026, 8, 11, 21, 0);
    const at = (h: number) => new Date(2026, 8, 11, h, 0).toISOString();
    const rows = [
      { eaten_at: at(12), meal_slot: "lunch", foods: [{ name_ko: "바게트" }, { name_ko: "참치 샐러드" }] },
      { eaten_at: at(19), meal_slot: "dinner", foods: [{ name_ko: "피자" }, { name_ko: "샐러드" }] },
    ];
    const role = proteinRoleBySlot(rows, now);
    expect(role).toMatchObject({ lunch: true, dinner: false });
    const r = goalMealCoaching(U70({ weightKg: 82, age: 58, meals: [L(5.3), D(22.8)], proteinRoleBySlot: role }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].meals.map((m) => m.slot)).toEqual(["dinner"]);
  });
});
