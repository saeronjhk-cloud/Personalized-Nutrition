/** 홈 P1 10초 밥상 데모 — D01~D04·D06·D10 · 정본 IP/integration/home_demo_eval_v1.md */
import { describe, it, expect } from "vitest";
import { mealDemo, DEMO_FOODS, DEMO_TIMELINE_MS } from "../meal_demo";
import { resolveRoles } from "../../coaching/meal_role";
import { GRAMMAR_TEMPLATES } from "../../coaching/meal_grammar";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("홈 밥상 데모", () => {
  it("D01 예시 음식 역할 고정·UNKNOWN 0", () => {
    expect(DEMO_FOODS.map((f) => resolveRoles(f.name))).toEqual([["RICE"], ["BROTH"], ["KIMCHI"], ["VEG"]]);
    expect(mealDemo().foods.map((f) => f.roleLabel)).toEqual(["주식", "국", "김치", "채소 반찬"]);
  });
  it("D02 확인표", () => {
    expect(mealDemo().checks).toEqual([
      { label: "주식", ok: true },
      { label: "채소 반찬", ok: true },
      { label: "단백질 반찬", ok: false },
    ]);
  });
  it("D03 코칭 문장 = 엔진 G-PRO 출력", () => {
    const d = mealDemo();
    expect(d.card?.rule).toBe("G-PRO");
    expect(d.card?.text).toBe(GRAMMAR_TEMPLATES["G-PRO"].replace("{slots}", "점심"));
  });
  it("D04 결정론", () => {
    expect(mealDemo()).toEqual(mealDemo());
  });
  it("D06 금지어 없음(도메인)", () => {
    const src = readFileSync(resolve(__dirname, "../meal_demo.ts"), "utf-8");
    expect(src + JSON.stringify(mealDemo())).not.toMatch(/kcal|칼로리|점수|감량|GLP-1|보장|최초|유일/);
  });
  it("D10 타임라인 ≤ 10초·오름차순", () => {
    const t = Object.values(DEMO_TIMELINE_MS);
    expect(Math.max(...t)).toBeLessThanOrEqual(10000);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
  });
});
