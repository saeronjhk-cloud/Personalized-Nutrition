/** 영양 기준 KDRI-2025 — 평가셋 IP/evals/eval_kdri2025_v1.json(복사본 같은 폴더) K01~K22 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KDRI_VERSION, sodiumCdrrMg, fiberAiG, UL_V0 } from "../kdri";
import { dietToScores, DIET_CRITERIA_VERSION } from "../../unified/diet_adapter";

const EV = JSON.parse(readFileSync(resolve(__dirname, "eval_kdri2025_v1.json"), "utf-8"));

describe("KDRI-2025 기준표", () => {
  it("버전", () => { expect(KDRI_VERSION).toBe(EV.criteria_version); expect(DIET_CRITERIA_VERSION).toBe(EV.criteria_version); });
  for (const c of EV.sodium) it(`${c.id} 나트륨 CDRR ${c.age}세`, () => expect(sodiumCdrrMg(c.age)).toBe(c.cdrr));
  for (const c of EV.fiber) it(`${c.id} 식이섬유 AI`, () => expect(fiberAiG(c.sex, c.age)).toBe(c.ai));
  for (const c of EV.ul) it(`${c.id} UL ${c.nutrient}`, () => {
    const e = UL_V0.find((x) => x.id === c.nutrient)!;
    expect(e.ul(c.sex, c.age)).toBe(c.ul);
    if (c.scope) expect(e.scope).toBe(c.scope);
  });
  for (const c of EV.diet_signal) it(`${c.id} ${c.note}`, () => {
    const r = dietToScores({ days: 7, kcal: 2000, protein_g: 80, sugar_g: 40, sodium_mg: c.sodium_mg, fiber_g: 25 }, { sex: "male", age: c.age, weightKg: 70, kcalTarget: 2000, enableMicroSignals: true });
    expect((r.scores["심혈관"] ?? 0) > 0).toBe(c.cardio);
  });
  it("수치 하드코딩 금지 — diet_adapter 에 2300·1900·1800 직접 숫자 없음", () => {
    const src = readFileSync(resolve(__dirname, "../../unified/diet_adapter.ts"), "utf-8");
    for (const n of ["2300", "1900", "1800"]) expect(src).not.toContain(n);
  });
});
