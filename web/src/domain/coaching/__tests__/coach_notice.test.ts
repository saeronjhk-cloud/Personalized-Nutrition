/**
 * 코칭 «판정 대상 없음» 안내 v1 — N01~N16 (Eval-First)
 * 정본: IP/integration/coach_notice_eval_v1.md
 */
import { describe, it, expect } from "vitest";
import { todayCoachNotice, NOTICE_TEXT, mealGrammarCoaching, type GrammarMealRow, type MealGrammarInput } from "../meal_grammar";

const NOW = new Date(2026, 9, 5, 20, 0, 0);
const HOUR: Record<string, number> = { breakfast: 8, lunch: 12, dinner: 18, snack: 15 };
const row = (slot: string | null, names: string[], daysAgo = 0): GrammarMealRow => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(HOUR[slot ?? "lunch"] ?? 12, 0, 0, 0);
  return { eaten_at: d.toISOString(), meal_slot: slot, foods: names.map((n) => ({ name_ko: n })) };
};
const IN = (rows: GrammarMealRow[], over: Partial<MealGrammarInput> = {}): MealGrammarInput => ({
  mealEnabled: true, loggedIn: true, rows, now: NOW, conditions: [], egfr: null, v1CardVisible: false, ...over,
});

describe("코칭 안내 N", () => {
  it("N01 기록 없음 → null", () => {
    expect(todayCoachNotice(IN([]))).toBeNull();
  });
  it("N02 간식뿐 → SNACK_ONLY", () => {
    const n = todayCoachNotice(IN([row("snack", ["애플 파이"])]));
    expect(n?.reason).toBe("SNACK_ONLY");
    expect(n?.text).toBe(NOTICE_TEXT.SNACK_ONLY);
  });
  it("N03 간식 + 판정 가능 점심 → null", () => {
    expect(todayCoachNotice(IN([row("snack", ["애플 파이"]), row("lunch", ["쌀밥", "계란찜", "상추"])]))).toBeNull();
  });
  it("N04 주식 + UNKNOWN → UNKNOWN·이름", () => {
    const n = todayCoachNotice(IN([row("lunch", ["쌀밥", "퀴노아볼"])]));
    expect(n?.reason).toBe("UNKNOWN");
    expect(n?.unknown_names).toEqual(["퀴노아볼"]);
    expect(n?.text).toBe("아직 알아보지 못한 음식이 있어 오늘 끼니를 판정하지 못했어요: 퀴노아볼. 음식 이름을 고치면 코칭이 다시 계산돼요.");
  });
  it("N05 주식 없는 점심 → NO_STAPLE", () => {
    expect(todayCoachNotice(IN([row("lunch", ["샐러드", "닭가슴살"])]))?.reason).toBe("NO_STAPLE");
  });
  it("N06 주식 없는 아침이라도 단백질 확인 → G-AM 판정 가능 → null", () => {
    expect(todayCoachNotice(IN([row("breakfast", ["닭가슴살"])]))).toBeNull();
  });
  it("N07 v1 카드 보임 → null", () => {
    expect(todayCoachNotice(IN([row("snack", ["애플 파이"])], { v1CardVisible: true }))).toBeNull();
  });
  it("N08 비로그인·식사 기능 꺼짐 → null", () => {
    expect(todayCoachNotice(IN([row("snack", ["애플 파이"])], { loggedIn: false }))).toBeNull();
    expect(todayCoachNotice(IN([row("snack", ["애플 파이"])], { mealEnabled: false }))).toBeNull();
  });
  it("N09 이름 중복 제거·최대 3개 + 외 N", () => {
    const n = todayCoachNotice(IN([row("lunch", ["쌀밥", "퀴노아볼", "아보카도", "플랫화이트", "뭔지모를음식", "퀴노아볼"])]));
    expect(n?.unknown_names).toEqual(["퀴노아볼", "아보카도", "플랫화이트", "뭔지모를음식"]);
    expect(n?.text).toContain(": 퀴노아볼·아보카도·플랫화이트 외 1.");
  });
  it("N10 slot 없는 행만 → null", () => {
    expect(todayCoachNotice(IN([row(null, ["애플 파이"])]))).toBeNull();
  });
  it("N11 신장 질환 차단 + 주식 없는 아침 → NO_STAPLE (G-AM 차단)", () => {
    const i = IN([row("breakfast", ["닭가슴살"])], { conditions: ["신장질환"] });
    expect(mealGrammarCoaching(i).blocked_reason).toBe("kidney_condition");
    expect(todayCoachNotice(i)?.reason).toBe("NO_STAPLE");
  });
  it("N12 어제만 기록 → null", () => {
    expect(todayCoachNotice(IN([row("snack", ["애플 파이"], 1)]))).toBeNull();
  });
  it("N13 활성 카드(G-PRO) 있으면 → null", () => {
    const i = IN([row("lunch", ["쌀밥", "김치찌개", "배추김치"])]);
    expect(mealGrammarCoaching(i).active?.rule).toBe("G-PRO");
    expect(todayCoachNotice(i)).toBeNull();
  });
  it("N14 간식의 UNKNOWN 은 이유 아님 → SNACK_ONLY", () => {
    expect(todayCoachNotice(IN([row("snack", ["뭔지모를음식"])]))?.reason).toBe("SNACK_ONLY");
  });
  it("N15 아침[플랫화이트] → UNKNOWN", () => {
    const n = todayCoachNotice(IN([row("breakfast", ["플랫화이트"])]));
    expect(n?.reason).toBe("UNKNOWN");
    expect(n?.unknown_names).toEqual(["플랫화이트"]);
  });
  it("N16 문구 고정·금지어 0", () => {
    expect(NOTICE_TEXT.SNACK_ONLY).toBe("간식은 끼니 코칭에 들어가지 않아요. 아침·점심·저녁 끼니를 기록하면 코칭이 시작돼요.");
    expect(NOTICE_TEXT.NO_STAPLE).toBe("밥이나 면이 있는 끼니를 기록하면 반찬 코칭이 시작돼요.");
    expect(NOTICE_TEXT.UNKNOWN).toBe("아직 알아보지 못한 음식이 있어 오늘 끼니를 판정하지 못했어요: {names}. 음식 이름을 고치면 코칭이 다시 계산돼요.");
    for (const t of Object.values(NOTICE_TEXT)) for (const w of ["kcal", "점수", "감량", "GLP-1", "보장", "최초", "유일", "서박사"]) expect(t).not.toContain(w);
  });
});
