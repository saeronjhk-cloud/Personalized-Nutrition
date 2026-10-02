/**
 * eGFR 산출(CKD-EPI 2021) 평가셋 E01~E14 · 정본 IP/integration/egfr_ckd_epi_eval_v1.md
 */
import { describe, it, expect } from "vitest";
import { ckdEpi2021, resolveEgfr } from "../egfr";
import { goalMealCoaching, type CoachingInput } from "../../coaching/goal_meal_coaching";

const cr = (value: number, unit = "mg/dL") => ({ creatinine: { value, unit } });

describe("E eGFR CKD-EPI 2021", () => {
  it("E01 남 50세 1.0 → 91.7 (NKF 92)", () => expect(ckdEpi2021(1.0, 50, "male")).toBe(91.7));
  it("E02 여 60세 1.0 → 64.5 (NKF 64)", () => expect(ckdEpi2021(1.0, 60, "female")).toBe(64.5));
  it("E03 남 70세 1.5 → 49.8", () => expect(ckdEpi2021(1.5, 70, "male")).toBe(49.8));
  it("E04 여 45세 0.6 → 112.7 (Scr<κ)", () => expect(ckdEpi2021(0.6, 45, "female")).toBe(112.7));
  it("E05 μmol/L 환산", () => expect(resolveEgfr(cr(88.4, "μmol/L"), 50, "male")).toEqual({ value: 91.7, source: "ckd_epi_2021" }));
  it("E06 성별 미상 → 낮은 값", () => expect(resolveEgfr(cr(1.0), 70, undefined).value).toBe(60.6));
  it("E07 나이 null → null", () => expect(resolveEgfr(cr(1.0), null, "male")).toEqual({ value: null, source: null }));
  it("E08 비정상 Scr → null", () => {
    for (const v of [0, -1, NaN, 20]) expect(resolveEgfr(cr(v), 50, "male").value).toBeNull();
  });
  it("E09 측정 eGFR 우선", () =>
    expect(resolveEgfr({ egfr: { value: 75, unit: "" }, creatinine: { value: 3.0, unit: "mg/dL" } }, 50, "male")).toEqual({ value: 75, source: "measured" }));
  it("E12 17세 → null", () => expect(resolveEgfr(cr(1.0), 17, "male").value).toBeNull());
  it("E13 단위 '' 은 mg/dL", () => expect(resolveEgfr(cr(1.0, ""), 50, "male").value).toBe(91.7));
  it("E14 값 없음 → null", () => expect(resolveEgfr({}, 50, "male")).toEqual({ value: null, source: null }));

  const U = (egfr: number | null): CoachingInput => ({
    mealEnabled: true, loggedIn: true, goals: ["근육증가"], weightKg: 70, heightCm: 175, age: 72,
    conditions: [], egfr, meals: [{ slot: "breakfast", protein_g: 5 }],
  });
  it("E10 남 72세 1.30 → 58.4 → v1 게이트 차단", () => {
    const e = resolveEgfr(cr(1.3), 72, "male").value;
    expect(e).toBe(58.4);
    expect(goalMealCoaching(U(e)).blocked_reason).toBe("egfr_low");
  });
  it("E11 남 72세 1.27 → 60.0 → 통과", () => {
    const e = resolveEgfr(cr(1.27), 72, "male").value;
    expect(e).toBe(60);
    expect(goalMealCoaching(U(e)).cards).toHaveLength(1);
  });
});
