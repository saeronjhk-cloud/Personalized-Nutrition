/**
 * Phase H 평가셋 v1 — «내 건강» 🥗 식이 카드 상태 판정
 * 참조: IP/integration/phase_h_diet_card_eval_v1.md (H01~H10)
 */
import { describe, it, expect } from "vitest";
import { dietCardStatus } from "../diet_card";
import { dietToScores, DIET_MIN_DAYS, type DietDailyAvg } from "../diet_adapter";
import { aggregateMeals } from "../meal_aggregate";

const on = (days: number | null, isLoggedIn = true) => dietCardStatus({ mealEnabled: true, isLoggedIn, days });

describe("Phase H — 식이 카드 상태", () => {
  it("H01 MEAL OFF → 준비 중 (종전)", () => {
    const s = dietCardStatus({ mealEnabled: false, isLoggedIn: true, days: 7 });
    expect(s.kind).toBe("soon");
    expect(s.badge).toBe("준비 중");
  });

  it("H02 비로그인 → 미입력", () => {
    expect(on(0, false)).toMatchObject({ kind: "guest", badge: "미입력" });
  });

  it("H03 조회 실패 → error (기록 없음과 구분)", () => {
    const s = on(null);
    expect(s.kind).toBe("error");
    expect(s.badge).not.toBe(on(0).badge);
  });

  it("H04 0일 → 기록 없음", () => {
    expect(on(0)).toMatchObject({ kind: "none", badge: "기록 없음" });
  });

  it("H05 1일 → low · 1일 더", () => {
    expect(on(1)).toMatchObject({
      kind: "low",
      remainingDays: 1,
      badge: "최근 7일 중 1일 기록 · 1일 더 기록하면 추천에 반영",
    });
  });

  it("H06 2일(경계) → ok", () => {
    expect(on(2)).toMatchObject({ kind: "ok", badge: "최근 7일 중 2일 기록 · 추천에 반영 중", tone: "done" });
  });

  it("H07 7일 → ok", () => {
    expect(on(7)).toMatchObject({ kind: "ok", days: 7 });
  });

  it("H08 0~7일: ok ⇔ 추천 엔진 lowConfidence=false", () => {
    expect(DIET_MIN_DAYS).toBe(2);
    for (let d = 0; d <= 7; d++) {
      const avg: DietDailyAvg = { days: d, kcal: 1950, protein_g: 70, sugar_g: 40, sodium_mg: 1800, fiber_g: 32 };
      const engineUses = !dietToScores(avg).lowConfidence;
      expect(on(d).kind === "ok").toBe(engineUses);
    }
  });

  it("H09 실제 행 → aggregateMeals.days → 상태 (같은 날 3끼 + 다른 날 1끼 = 2일)", () => {
    const rows = [
      // dateKey 는 실행 환경 «로컬» 날짜 기준(브라우저=KST). 테스트는 UTC·KST 에서 같은 날짜가 되는 시각만 사용.
      { eaten_at: "2026-09-28T10:00:00+09:00", kcal: 500 },
      { eaten_at: "2026-09-28T13:00:00+09:00", kcal: 700 },
      { eaten_at: "2026-09-28T18:00:00+09:00", kcal: 600 },
      { eaten_at: "2026-09-26T12:00:00+09:00", kcal: 650 },
    ];
    const days = aggregateMeals(rows, 7).days;
    expect(days).toBe(2);
    expect(on(days).kind).toBe("ok");
    expect(on(aggregateMeals(rows.slice(0, 3), 7).days).kind).toBe("low");
  });

  it("H10 days=9 → 7 로 클램프", () => {
    expect(on(9)).toMatchObject({ kind: "ok", days: 7 });
  });
});
