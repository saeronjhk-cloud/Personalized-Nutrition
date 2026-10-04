/** 평가: IP/integration/home_redesign_v1_design.md §3 (H01~H09·H14) */
import { describe, it, expect } from "vitest";
import { homeMode, startOptions, todaySlots, todayCards, greeting } from "../home_mode";

describe("homeMode", () => {
  it("H01 비로그인 → visitor", () => expect(homeMode({ isLoggedIn: false, hasAnyRecord: true })).toBe("visitor"));
  it("H02 로그인 + 기록 0 → visitor", () => expect(homeMode({ isLoggedIn: true, hasAnyRecord: false })).toBe("visitor"));
  it("H03 로그인 + 기록 → returning", () => expect(homeMode({ isLoggedIn: true, hasAnyRecord: true })).toBe("returning"));
});

describe("startOptions", () => {
  it("H04 모두 ON", () => {
    const r = startOptions({ meal: true, checkup: true, meokseon: true });
    expect(r.main.map((o) => o.id)).toEqual(["meal", "survey", "checkup"]);
    expect(r.extra?.id).toBe("scan");
    expect(r.main[0].desc).toContain("가장 빠름");
  });
  it("H05 MEAL OFF → 설문이 첫째", () => {
    expect(startOptions({ meal: false, checkup: true, meokseon: true }).main.map((o) => o.id)).toEqual(["survey", "checkup"]);
  });
  it("H06 모두 OFF → 설문 1개", () => {
    const r = startOptions({ meal: false, checkup: false, meokseon: false });
    expect(r.main.map((o) => o.id)).toEqual(["survey"]);
    expect(r.extra).toBeNull();
  });
});

describe("todaySlots", () => {
  const now = new Date(2026, 9, 4, 20, 0);
  const at = (h: number, m = 0, day = 4) => new Date(2026, 9, day, h, m).toISOString();
  it("H07 아침·저녁", () => {
    expect(todaySlots([{ eaten_at: at(8), meal_slot: "breakfast" }, { eaten_at: at(19), meal_slot: "dinner" }], now)).toEqual([true, false, true]);
  });
  it("H08 어제 23:30 → 오늘 0", () => {
    expect(todaySlots([{ eaten_at: at(23, 30, 3), meal_slot: "dinner" }], now)).toEqual([false, false, false]);
  });
  it("H09 null·snack·잘못된 날짜 제외", () => {
    expect(todaySlots([{ eaten_at: at(15), meal_slot: "snack" }, { eaten_at: at(12), meal_slot: null }, { eaten_at: "x", meal_slot: "lunch" }], now)).toEqual([false, false, false]);
  });
});

describe("todayCards", () => {
  it("H14 /meal 과 같은 순서로 켜진 카드 모두(v1 → P1) — 한쪽만 고르면 v1 보이는 날 P1 이 단백질을 양보해 홈이 비는 문제 방지", () => {
    expect(todayCards({ meal: true, mealGrammar: true, goalCoaching: true })).toEqual(["goal", "grammar"]);
    expect(todayCards({ meal: true, mealGrammar: false, goalCoaching: true })).toEqual(["goal"]);
    expect(todayCards({ meal: true, mealGrammar: true, goalCoaching: false })).toEqual(["grammar"]);
    expect(todayCards({ meal: true, mealGrammar: false, goalCoaching: false })).toEqual([]);
    expect(todayCards({ meal: false, mealGrammar: true, goalCoaching: true })).toEqual([]);
  });
  it("인사", () => {
    expect(greeting(new Date(2026, 9, 4, 8))).toBe("좋은 아침이에요");
    expect(greeting(new Date(2026, 9, 4, 13))).toBe("좋은 오후예요");
    expect(greeting(new Date(2026, 9, 4, 20))).toBe("좋은 저녁이에요");
  });
});
