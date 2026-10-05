/** 검진 판정표 v1.2(국가건강검진 고시) C01~C09 · 정본 IP/integration/checkup_ranges_v1_2_eval.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rangeIssues, rangesFromMap, type BiomarkerMap } from "../range_gaps";
import { runEngine, type Range } from "../engine";
import { withEgfrInput } from "../egfr_input";
import v12json from "../biomarker_map_v1_2.json";
import v11json from "../biomarker_map_v1_1.json";

const v12 = v12json as unknown as BiomarkerMap;
const R = rangesFromMap(v12) as Range[];
const forSex = (sex: "M" | "F") => R.filter((r) => r.sex_specific === null || r.sex_specific === sex);
const judge = (sex: "M" | "F", key: string, v: number) => {
  const x = runEngine({ [key]: v }, forSex(sex))[0];
  return x.force_medical_referral ? "상담" : x.label_ko;
};
const IN = "참고범위 내", HI = "참고범위보다 높음", LO = "참고범위보다 낮음", SLO = "참고범위보다 약간 낮음", REF = "상담";
const sql = readFileSync(resolve(__dirname, "../../../../supabase/158_biomarker_ranges_v1_2_nhis.sql"), "utf-8");

describe("판정표 v1.2", () => {
  it("C01 18항목·68구간·틈 0·0부터", () => {
    expect(Object.keys(v12.biomarkers)).toHaveLength(18);
    expect(R).toHaveLength(68);
    expect(rangeIssues(R)).toEqual([]);
    for (const [k, b] of Object.entries(v12.biomarkers)) {
      const sexes = [...new Set(b.ranges.map((r) => r.sex_specific ?? null))];
      for (const s of sexes) expect([k, s, Math.min(...b.ranges.filter((r) => (r.sex_specific ?? null) === s).map((r) => r.min))]).toEqual([k, s, 0]);
    }
  });
  it("C02 고시 경계값", () => {
    const cases: [string, "M" | "F", number, string][] = [
      ["AST", "M", 40, IN], ["AST", "F", 41, HI], ["AST", "M", 50, HI], ["AST", "M", 51, REF],
      ["ALT", "F", 35, IN], ["ALT", "M", 36, HI], ["ALT", "M", 45, HI], ["ALT", "F", 46, REF],
      ["GGT", "M", 63, IN], ["GGT", "M", 64, HI], ["GGT", "M", 77, HI], ["GGT", "M", 78, REF],
      ["GGT", "F", 35, IN], ["GGT", "F", 36, HI], ["GGT", "F", 45, HI], ["GGT", "F", 46, REF],
      ["hemoglobin", "M", 11.9, REF], ["hemoglobin", "M", 12, SLO], ["hemoglobin", "M", 12.9, SLO], ["hemoglobin", "M", 13, IN], ["hemoglobin", "M", 16.5, IN], ["hemoglobin", "M", 16.6, HI], ["hemoglobin", "M", 17.9, HI], ["hemoglobin", "M", 18, REF],
      ["hemoglobin", "F", 9.9, REF], ["hemoglobin", "F", 10, SLO], ["hemoglobin", "F", 11.9, SLO], ["hemoglobin", "F", 12, IN], ["hemoglobin", "F", 15.5, IN], ["hemoglobin", "F", 15.6, HI], ["hemoglobin", "F", 16.9, HI], ["hemoglobin", "F", 17, REF],
      ["fasting_glucose", "M", 69, REF], ["fasting_glucose", "M", 70, IN], ["fasting_glucose", "M", 99, IN], ["fasting_glucose", "M", 100, HI], ["fasting_glucose", "M", 125, HI], ["fasting_glucose", "M", 126, REF],
      ["total_cholesterol", "M", 199, IN], ["total_cholesterol", "M", 200, HI], ["total_cholesterol", "M", 239, HI], ["total_cholesterol", "M", 240, REF],
      ["HDL", "F", 39, REF], ["HDL", "F", 40, LO], ["HDL", "F", 59, LO], ["HDL", "F", 60, IN],
      ["triglyceride", "M", 149, IN], ["triglyceride", "M", 150, HI], ["triglyceride", "M", 199, HI], ["triglyceride", "M", 200, REF],
      ["LDL", "M", 129, IN], ["LDL", "M", 130, HI], ["LDL", "M", 159, HI], ["LDL", "M", 160, REF],
      ["blood_pressure_systolic", "M", 89, LO], ["blood_pressure_systolic", "M", 90, IN], ["blood_pressure_systolic", "M", 119, IN], ["blood_pressure_systolic", "M", 120, HI], ["blood_pressure_systolic", "M", 139, HI], ["blood_pressure_systolic", "M", 140, REF],
      ["blood_pressure_diastolic", "F", 59, LO], ["blood_pressure_diastolic", "F", 60, IN], ["blood_pressure_diastolic", "F", 79, IN], ["blood_pressure_diastolic", "F", 80, HI], ["blood_pressure_diastolic", "F", 89, HI], ["blood_pressure_diastolic", "F", 90, REF],
      ["BMI", "M", 18.4, LO], ["BMI", "M", 18.5, IN], ["BMI", "M", 24.9, IN], ["BMI", "M", 25, HI], ["BMI", "M", 29.9, HI], ["BMI", "M", 30, REF],
      ["waist", "M", 89.9, IN], ["waist", "M", 90, REF], ["waist", "F", 84.9, IN], ["waist", "F", 85, REF],
      ["creatinine", "F", 1.5, IN], ["creatinine", "F", 1.51, REF], ["creatinine", "M", 0.4, IN],
      ["egfr", "M", 59.9, REF], ["egfr", "M", 60, IN],
      ["vitamin_D", "M", 19, LO], ["vitamin_D", "M", 29, SLO], ["vitamin_D", "M", 30, IN], ["vitamin_D", "M", 100, REF],
      ["HbA1c", "M", 5.6, IN], ["HbA1c", "M", 5.7, HI], ["HbA1c", "M", 6.5, REF],
    ];
    for (const [k, s, v, want] of cases) expect([k, s, v, judge(s, k, v)]).toEqual([k, s, v, want]);
  });
  it("C03 라벨 다섯 개만 · 질병명 0", () => {
    const labels = new Set(R.map((r) => r.label_ko));
    for (const l of labels) expect([IN, HI, LO, SLO, "의료진 상담 권장"]).toContain(l);
    expect(JSON.stringify([...labels])).not.toMatch(/비만|결핍|당뇨|고혈압|빈혈|정상|주의|경계/);
  });
  it("C04 상담 플래그 ⇔ tone ⇔ 라벨", () => {
    for (const r of R) {
      expect([r.biomarker_key, r.force_medical_referral]).toEqual([r.biomarker_key, r.tone === "전문가상담권장"]);
      expect([r.biomarker_key, r.force_medical_referral]).toEqual([r.biomarker_key, r.label_ko === "의료진 상담 권장"]);
    }
  });
  it("C05 참고범위 내·혈색소 상한·비타민D 상한은 기능성 필요 없음", () => {
    for (const r of R.filter((x) => x.level === "normal")) expect([r.biomarker_key, r.functional_needs]).toEqual([r.biomarker_key, []]);
    expect(runEngine({ vitamin_D: 120 }, forSex("M"))[0].functional_needs).toEqual([]);
    expect(runEngine({ hemoglobin: 17 }, forSex("M"))[0].functional_needs).toEqual([]);
  });
  it("C06 SQL 158 = JSON", () => {
    expect(sql).toContain("on conflict (biomarker_key) do update set");
    for (const k of Object.keys(v12.biomarkers)) expect(sql).toContain(`('${k}', `);
    const rows = sql.split("\n").filter((l) => /^\('[A-Za-z0-9_]+', [\d.]+, [\d.]+, '/.test(l));
    expect(rows).toHaveLength(68);
    expect(sql).toContain("lead(range_min) over");
  });
  it("C07 기능성 필요 이름 집합 = v1.1 (결정 D2)", () => {
    const names = (m: BiomarkerMap) => new Set(Object.values(m.biomarkers).flatMap((b) => b.ranges.flatMap((r) => r.functional_needs)));
    expect([...names(v12)].sort()).toEqual([...names(v11json as unknown as BiomarkerMap)].sort());
  });
  it("C08 eGFR 추정 — 렌즈 A 위험 사례", () => {
    const f = withEgfrInput({ creatinine: 1.1 }, { sex: "F", birthYear: 1966, recordedDate: "2026-05-27" });
    const m = withEgfrInput({ creatinine: 1.1 }, { sex: "M", birthYear: 1966, recordedDate: "2026-05-27" });
    expect(f.derived).toBe(true);
    expect(f.input.egfr).toBeGreaterThan(57);
    expect(f.input.egfr).toBeLessThan(58.5);
    expect(m.input.egfr).toBeGreaterThan(76);
    expect(m.input.egfr).toBeLessThan(78);
    expect(judge("F", "egfr", f.input.egfr)).toBe(REF);
    expect(judge("M", "egfr", m.input.egfr)).toBe(IN);
    expect(judge("F", "creatinine", 1.1)).toBe(IN); // 크레아티닌만 보면 놓치는 사례
  });
  it("C09 eGFR 추정 조건", () => {
    expect(withEgfrInput({ creatinine: 1.1, egfr: 80 }, { sex: "F", birthYear: 1966, recordedDate: "2026-05-27" })).toEqual({ input: { creatinine: 1.1, egfr: 80 }, derived: false });
    expect(withEgfrInput({ HDL: 50 }, { sex: "F", birthYear: 1966, recordedDate: "2026-05-27" }).derived).toBe(false);
    expect(withEgfrInput({ creatinine: 1.1 }, { sex: "F", birthYear: null, recordedDate: "2026-05-27" }).derived).toBe(false);
    const u = withEgfrInput({ creatinine: 1.1 }, { sex: null, birthYear: 1966, recordedDate: "2026-05-27" });
    const f = withEgfrInput({ creatinine: 1.1 }, { sex: "F", birthYear: 1966, recordedDate: "2026-05-27" });
    expect(u.input.egfr).toBe(f.input.egfr);
  });
});
