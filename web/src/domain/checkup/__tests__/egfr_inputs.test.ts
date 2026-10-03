/**
 * eGFR 산출용 성별·나이 출처 평가셋 E15~E25 · 정본 IP/integration/egfr_ckd_epi_eval_v1.md «v2 추가»
 */
import { describe, it, expect } from "vitest";
import { egfrDemographics, surveySexKnown } from "../egfr_inputs";
import { resolveEgfr } from "../egfr";
import { goalMealCoaching, type CoachingInput } from "../../coaching/goal_meal_coaching";

const TODAY = new Date(2026, 9, 3);
const base = { profileSex: null, profileBirthYear: null, recordedDate: null, surveySex: null, surveySexKnown: false, surveyAge: null, today: TODAY };

describe("E v2 eGFR 성별·나이 출처", () => {
  it("E15 프로필 F 우선", () =>
    expect(egfrDemographics({ ...base, profileSex: "F", surveySex: "male", surveySexKnown: true })).toMatchObject({ sex: "female", sexSource: "profile" }));
  it("E16 프로필 없음 → 설문 실응답", () =>
    expect(egfrDemographics({ ...base, surveySex: "female", surveySexKnown: true })).toMatchObject({ sex: "female", sexSource: "survey" }));
  it("E17 설문 기본값 채움은 불인정 → 미상", () =>
    expect(egfrDemographics({ ...base, surveySex: "male", surveySexKnown: false })).toMatchObject({ sex: null, sexSource: null }));
  it("E18 프로필 sex 'X'·'' → 설문 폴백", () => {
    expect(egfrDemographics({ ...base, profileSex: "X", surveySex: "female", surveySexKnown: true }).sex).toBe("female");
    expect(egfrDemographics({ ...base, profileSex: "", surveySex: "male", surveySexKnown: true }).sex).toBe("male");
  });
  it("E19 검진일 연도 − 출생연도", () =>
    expect(egfrDemographics({ ...base, profileBirthYear: 1960, recordedDate: "2026-05-10", surveyAge: 30 })).toMatchObject({ age: 66, ageSource: "profile" }));
  it("E20 출생연도 없음 → 설문 나이", () =>
    expect(egfrDemographics({ ...base, surveyAge: 45 })).toMatchObject({ age: 45, ageSource: "survey" }));
  it("E21 검진일 없음·형식 오류 → 오늘 연도", () => {
    expect(egfrDemographics({ ...base, profileBirthYear: 1960 }).age).toBe(66);
    expect(egfrDemographics({ ...base, profileBirthYear: 1960, recordedDate: "abc" }).age).toBe(66);
  });
  it("E22 비정상 출생연도 → 설문 나이", () => {
    expect(egfrDemographics({ ...base, profileBirthYear: 2030, recordedDate: "2026-01-01", surveyAge: 40 })).toMatchObject({ age: 40, ageSource: "survey" });
    expect(egfrDemographics({ ...base, profileBirthYear: 1800, surveyAge: 40 }).age).toBe(40);
  });
  it("E23 통합: 여 60세 Scr 1.1 → 57.5 차단 (설문 기본값 남30 이면 92.6 통과였음)", () => {
    const d = egfrDemographics({ ...base, profileSex: "F", profileBirthYear: 1966, recordedDate: "2026-03-01", surveySex: "male", surveySexKnown: false, surveyAge: 30 });
    const e = resolveEgfr({ creatinine: { value: 1.1, unit: "mg/dL" } }, d.age, d.sex).value;
    expect(e).toBe(57.5);
    expect(resolveEgfr({ creatinine: { value: 1.1, unit: "mg/dL" } }, 30, "male").value).toBe(92.6);
    const U: CoachingInput = { mealEnabled: true, loggedIn: true, goals: ["근육증가"], weightKg: 60, heightCm: 160, age: 30,
      conditions: [], egfr: e, meals: [{ slot: "breakfast", protein_g: 5 }] };
    expect(goalMealCoaching(U).blocked_reason).toBe("egfr_low");
  });
  it("E24 surveySexKnown", () => {
    expect(surveySexKnown({ answers: { 성별: "male" }, gender: null })).toBe(true);
    expect(surveySexKnown({ answers: null, gender: "female" })).toBe(true);
    expect(surveySexKnown({ answers: null, gender: null })).toBe(false);
    expect(surveySexKnown({ answers: { 성별: "" }, gender: "female" })).toBe(false);
  });
  it("E25 출처 없음 → age null → eGFR null", () => {
    const d = egfrDemographics(base);
    expect(d).toMatchObject({ age: null, sex: null });
    expect(resolveEgfr({ creatinine: { value: 1.0, unit: "mg/dL" } }, d.age, d.sex).value).toBeNull();
  });
});
