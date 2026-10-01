/**
 * 한식 끼니 문법 P1 — 규칙·카드(G01~G18) · 검증 루프(V01~V08) 평가셋 — Eval-First
 * 정본: IP/integration/meal_grammar_p1_eval_v1.md · 설계: IP/integration/meal_grammar_p1_design_v1.md
 */
import { describe, it, expect } from "vitest";
import {
  mealGrammarCoaching,
  evidenceText,
  GRAMMAR_TEMPLATES,
  GRAMMAR_WHY,
  EVIDENCE_LABEL,
  type GrammarMealRow,
  type MealGrammarInput,
} from "../meal_grammar";

const NOW = new Date(2026, 9, 2, 20, 0, 0); // 2026-10-02 20:00 로컬
const at = (daysAgo: number, hour: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const HOUR: Record<string, number> = { breakfast: 8, lunch: 12, dinner: 18, snack: 15 };
const row = (slot: string | null, names: string[] | null, daysAgo = 0): GrammarMealRow => ({
  eaten_at: at(daysAgo, HOUR[slot ?? "lunch"] ?? 12),
  meal_slot: slot,
  foods: names === null ? null : names.map((n) => ({ name_ko: n })),
});
const IN = (rows: GrammarMealRow[], over: Partial<MealGrammarInput> = {}): MealGrammarInput => ({
  mealEnabled: true, loggedIn: true, rows, now: NOW, conditions: [], egfr: null, v1CardVisible: false, ...over,
});

describe("G 규칙·카드", () => {
  it("G01 G-PRO·G-VEG 동시 → 고정 순서 G-PRO · [lunch]", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "김치찌개", "배추김치"])]));
    expect(r.active?.rule).toBe("G-PRO");
    expect(r.active?.slots).toEqual(["lunch"]);
    expect(r.active?.text).toBe("오늘 점심에는 단백질 반찬이 없었습니다. 다음 끼니에 달걀·두부·생선 중 한 가지를 더합니다.");
  });
  it("G02 둘 다 충족 → 없음", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "제육볶음", "상추"])]));
    expect(r.active).toBeNull();
    expect(r.maintenance).toBeNull();
  });
  it("G03 김치는 채소로 안 셈 → G-VEG", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "계란찜", "배추김치"])]));
    expect(r.active?.rule).toBe("G-VEG");
    expect(r.active?.slots).toEqual(["lunch"]);
  });
  it("G04 같은 아침이면 G-PRO 우선", () => {
    const r = mealGrammarCoaching(IN([row("breakfast", ["토스트", "아메리카노"])]));
    expect(r.active?.rule).toBe("G-PRO");
    expect(r.active?.slots).toEqual(["breakfast"]);
  });
  it("G05 주식 아닌 아침 → G-AM", () => {
    const r = mealGrammarCoaching(IN([row("breakfast", ["사과"])]));
    expect(r.active?.rule).toBe("G-AM");
    expect(r.active?.text).toBe(GRAMMAR_TEMPLATES["G-AM"]);
  });
  it("G06 아침 미기록은 벌점 없음", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "계란찜", "시금치나물"])]));
    expect(r.active).toBeNull();
  });
  it("G07 미상 ≠ 없음", () => {
    expect(mealGrammarCoaching(IN([row("lunch", ["쌀밥", "모둠반찬"])])).active).toBeNull();
  });
  it("G08 단백질 true · 채소 미상 → 없음", () => {
    expect(mealGrammarCoaching(IN([row("lunch", ["쌀밥", "모둠반찬", "계란말이"])])).active).toBeNull();
  });
  it("G09 간식 제외", () => {
    expect(mealGrammarCoaching(IN([row("snack", ["과자"])])).active).toBeNull();
  });
  it("G10 같은 끼니 두 행 합산 → G-VEG", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "배추김치"]), row("lunch", ["고등어구이"])]));
    expect(r.active?.rule).toBe("G-VEG");
    expect(r.stats["G-PRO"]).toEqual({ opps: 1, success: 1, graduated: false });
  });
  it("G11 slot 없는 행 제외", () => {
    expect(mealGrammarCoaching(IN([row(null, ["쌀밥", "김치"])])).active).toBeNull();
  });
  it("G12 신장질환 → 단백질 차단, 채소 허용", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "김치찌개", "배추김치"])], { conditions: ["신장질환"] }));
    expect(r.active?.rule).toBe("G-VEG");
    expect(r.blocked_reason).toBe("kidney_condition");
  });
  it("G13 eGFR 55 → 없음 · egfr_low", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "된장찌개", "시금치나물"])], { egfr: 55 }));
    expect(r.active).toBeNull();
    expect(r.blocked_reason).toBe("egfr_low");
  });
  it("G13b eGFR 60 은 통과(경계)", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "된장찌개", "시금치나물"])], { egfr: 60 }));
    expect(r.active?.rule).toBe("G-PRO");
    expect(r.blocked_reason).toBeNull();
  });
  it("G14 v1 카드 보임 → 단백질 카드 중복 금지 → G-VEG", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "김치찌개", "배추김치"])], { v1CardVisible: true }));
    expect(r.active?.rule).toBe("G-VEG");
  });
  it("G15 slots 결합 «아침·점심»", () => {
    const r = mealGrammarCoaching(IN([row("breakfast", ["토스트"]), row("lunch", ["쌀밥", "배추김치"])]));
    expect(r.active?.rule).toBe("G-PRO");
    expect(r.active?.slots).toEqual(["breakfast", "lunch"]);
    expect(r.active?.text.startsWith("오늘 아침·점심에는")).toBe(true);
  });
  it("G16 foods null/빈 배열 행 → 없음", () => {
    expect(mealGrammarCoaching(IN([row("lunch", null), row("dinner", [])])).active).toBeNull();
  });
  it("G17 결정론 · 기능 꺼짐/비로그인 → 없음", () => {
    const i = IN([row("lunch", ["쌀밥", "김치찌개"])]);
    expect(mealGrammarCoaching(i)).toEqual(mealGrammarCoaching(i));
    expect(mealGrammarCoaching({ ...i, mealEnabled: false }).active).toBeNull();
    expect(mealGrammarCoaching({ ...i, loggedIn: false }).active).toBeNull();
  });
  it("G18 문구 금지어 0 · 존대 평서형", () => {
    const banned = ["줄이", "덜 ", "빼", "금지", "kg", "체중", "칼로리", "kcal", "질환", "위험", "진단", "감량", "요요"];
    const all = [...Object.values(GRAMMAR_TEMPLATES), ...Object.values(GRAMMAR_WHY), ...Object.values(EVIDENCE_LABEL)];
    for (const t of all) for (const w of banned) expect(t).not.toContain(w);
    for (const t of Object.values(GRAMMAR_TEMPLATES)) expect(t).toMatch(/(습니다|합니다)\.$/);
  });
});

/** n 끼 과거 점심(1~n일 전) — protein 여부 지정 */
const past = (spec: ("p" | "x" | "?")[]) =>
  spec.map((s, i) => row("lunch", s === "p" ? ["쌀밥", "계란찜"] : s === "x" ? ["쌀밥", "배추김치"] : ["쌀밥", "모둠반찬"], i + 1));
const TODAY_NO_PRO = row("lunch", ["쌀밥", "시금치나물"]);

describe("V 검증 루프", () => {
  it("V01 9/10 → 졸업 · 활성 없음 · 유지 G-PRO 9/10", () => {
    const r = mealGrammarCoaching(IN([...past(Array(9).fill("p")), TODAY_NO_PRO]));
    expect(r.stats["G-PRO"]).toEqual({ opps: 10, success: 9, graduated: true });
    expect(r.active).toBeNull();
    expect(r.maintenance).toEqual({ rule: "G-PRO", success: 9, opps: 10, text: "유지 중: 단백질 반찬이 있었던 끼니 9/10" });
  });
  it("V02 5/6 → 최소 기회 미달 → 활성 · 증거 5/6", () => {
    const r = mealGrammarCoaching(IN([...past(Array(5).fill("p")), TODAY_NO_PRO]));
    expect(r.active?.rule).toBe("G-PRO");
    expect(r.active?.evidence).toEqual({ success: 5, opps: 6 });
  });
  it("V03 8/10 = 0.8 → 졸업(경계 포함)", () => {
    const r = mealGrammarCoaching(IN([...past([..."pppppppp".split(""), "x"] as ("p" | "x")[]), TODAY_NO_PRO]));
    expect(r.stats["G-PRO"]).toEqual({ opps: 10, success: 8, graduated: true });
    expect(r.active).toBeNull();
  });
  it("V04 7/10 → 미졸업 · 활성 · 증거 7/10", () => {
    const r = mealGrammarCoaching(IN([...past([..."ppppppp".split(""), "x", "x"] as ("p" | "x")[]), TODAY_NO_PRO]));
    expect(r.stats["G-PRO"].graduated).toBe(false);
    expect(r.active?.rule).toBe("G-PRO");
    expect(r.active?.evidence).toEqual({ success: 7, opps: 10 });
  });
  it("V05 15일 전 기록은 창 밖", () => {
    const old = Array.from({ length: 10 }, (_, i) => row("lunch", ["쌀밥", "계란찜"], 14 + i));
    const r = mealGrammarCoaching(IN([...old, TODAY_NO_PRO]));
    expect(r.active?.evidence).toEqual({ success: 0, opps: 1 });
  });
  it("V05b 13일 전(창 안 마지막 날)은 포함", () => {
    const r = mealGrammarCoaching(IN([row("lunch", ["쌀밥", "계란찜"], 13), TODAY_NO_PRO]));
    expect(r.active?.evidence).toEqual({ success: 1, opps: 2 });
  });
  it("V06 미상 끼니는 분모 제외", () => {
    const r = mealGrammarCoaching(IN([...past(Array(5).fill("?")), TODAY_NO_PRO]));
    expect(r.active?.evidence).toEqual({ success: 0, opps: 1 });
  });
  it("V07 증거 문구 형식", () => {
    const r = mealGrammarCoaching(IN([...past([..."ppppppp".split(""), "x", "x"] as ("p" | "x")[]), TODAY_NO_PRO]));
    expect(r.active?.evidence_text).toBe("최근 14일 단백질 반찬이 있었던 끼니 7/10");
  });
  it("V08 기회 0 → 증거 줄 없음 · G-AM 오늘 1회 → 0/1", () => {
    expect(evidenceText("G-AM", 0, 0, 14)).toBeNull();
    const r = mealGrammarCoaching(IN([row("breakfast", ["사과"])]));
    expect(r.active?.evidence_text).toBe("최근 14일 단백질 반찬이 있었던 아침 0/1");
  });
});
