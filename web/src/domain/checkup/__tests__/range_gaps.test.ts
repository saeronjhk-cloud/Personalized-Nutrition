/**
 * 검진 구간 틈 메우기 v1.1 — B01~B10 (Eval-First)
 * 정본: IP/integration/checkup_range_gap_eval_v1.md · 데이터: biomarker_map_v1_0/1_1.json(IP 복사본) · SQL 157
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rangeIssues, rangesFromMap, type BiomarkerMap } from "../range_gaps";
import { runEngine, type Range } from "../engine";
import v10json from "../biomarker_map_v1_0.json";
import v11json from "../biomarker_map_v1_1.json";

const v10 = v10json as unknown as BiomarkerMap;
const v11 = v11json as unknown as BiomarkerMap;
const R10 = rangesFromMap(v10) as Range[];
const R11 = rangesFromMap(v11) as Range[];
const forSex = (rs: Range[], sex: "M" | "F") => rs.filter((r) => r.sex_specific === null || r.sex_specific === sex);
const level = (rs: Range[], sex: "M" | "F", key: string, v: number) => runEngine({ [key]: v }, forSex(rs, sex))[0]?.level;
const sql = readFileSync(resolve(__dirname, "../../../../supabase/157_biomarker_ranges_gap_close_v1.sql"), "utf-8");

describe("검진 구간 틈 B", () => {
  it("B01 v1.0 은 틈 31개(겹침 0) — 문제 재현", () => {
    const is = rangeIssues(R10);
    expect(is.filter((i) => i.kind === "overlap")).toEqual([]);
    expect(is.filter((i) => i.kind === "gap")).toHaveLength(31);
    expect(level(R10, "M", "fasting_glucose", 99)).toBe("unknown");
    expect(level(R10, "M", "HbA1c", 5.6)).toBe("unknown");
  });
  it("B02 v1.1 은 틈·겹침 0", () => {
    expect(rangeIssues(R11)).toEqual([]);
  });
  it("B03 v1.0 에서 판정되던 값은 v1.1 에서도 같은 판정(0.01 간격 전수)", () => {
    let checked = 0;
    for (const sex of ["M", "F"] as const) {
      for (const key of Object.keys(v10.biomarkers)) {
        const top = Math.min(300, Math.max(...R10.filter((r) => r.biomarker_key === key).map((r) => r.range_min)) + 20);
        for (let i = 0; i <= Math.round(top * 100); i++) {
          const v = i / 100;
          const a = level(R10, sex, key, v);
          if (a === "unknown") continue;
          expect([key, sex, v, level(R11, sex, key, v)]).toEqual([key, sex, v, a]);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(50000);
  });
  it("B04 경계·소수 값이 판정됨", () => {
    const cases: [string, "M" | "F", number, string][] = [
      ["fasting_glucose", "M", 99, "normal"], ["fasting_glucose", "M", 99.5, "normal"], ["fasting_glucose", "M", 100, "watch"], ["fasting_glucose", "M", 125.5, "watch"], ["fasting_glucose", "M", 126, "high"],
      ["HbA1c", "M", 5.6, "normal"], ["HbA1c", "M", 5.65, "normal"], ["HbA1c", "M", 5.7, "watch"], ["HbA1c", "M", 6.45, "watch"],
      ["LDL", "M", 129, "normal"], ["LDL", "M", 159.5, "watch"], ["total_cholesterol", "M", 199, "normal"], ["triglyceride", "M", 149.5, "normal"],
      ["blood_pressure_systolic", "M", 119, "normal"], ["blood_pressure_systolic", "M", 139, "watch"],
      ["HDL", "M", 59, "watch"], ["HDL", "M", 39.5, "low"], ["HDL", "M", 60, "normal"],
      ["AST", "M", 40.5, "normal"], ["ALT", "F", 80.5, "watch"],
      ["GGT", "M", 63.5, "normal"], ["GGT", "F", 35.5, "normal"], ["GGT", "F", 36, "watch"],
      ["creatinine", "M", 1.2, "normal"], ["creatinine", "M", 1.5, "watch"], ["creatinine", "M", 1.505, "watch"],
      ["BMI", "M", 18.45, "low"], ["BMI", "M", 22.9, "normal"], ["BMI", "M", 24.95, "watch"], ["BMI", "M", 25, "high"],
      ["hemoglobin", "M", 12.95, "low"], ["hemoglobin", "F", 11.95, "low"],
      ["TSH", "M", 0.395, "low"], ["TSH", "M", 4.5, "normal"], ["TSH", "M", 4.505, "normal"],
      ["vitamin_D", "M", 19.5, "low"], ["vitamin_D", "M", 29.5, "watch"],
    ];
    for (const [k, s, v, want] of cases) expect([k, s, v, level(R11, s, k, v)]).toEqual([k, s, v, want]);
  });
  it("B05 끝 구간(새 기준 필요)은 이번 범위 밖 — 여전히 unknown", () => {
    expect(level(R11, "M", "creatinine", 0.5)).toBe("unknown");
    expect(level(R11, "M", "vitamin_D", 105)).toBe("unknown");
    expect(level(R11, "M", "hemoglobin", 17)).toBe("unknown");
    expect(level(R11, "F", "hemoglobin", 16)).toBe("unknown");
  });
  it("B06 기능성 필요·상담권장도 따라옴", () => {
    const r = runEngine({ HbA1c: 6.45, fasting_glucose: 99 }, forSex(R11, "M"));
    expect(r.find((x) => x.biomarker_key === "HbA1c")?.functional_needs).toEqual(["혈당조절"]);
    expect(r.find((x) => x.biomarker_key === "fasting_glucose")?.functional_needs).toEqual([]);
    expect(runEngine({ fasting_glucose: 125.5 }, forSex(R11, "M"))[0].force_medical_referral).toBe(false);
  });
  it("B07 바뀐 것은 range_max 뿐", () => {
    const strip = (m: BiomarkerMap) => Object.fromEntries(Object.entries(m.biomarkers).map(([k, b]) => [k, b.ranges.map(({ max: _max, ...rest }) => rest)]));
    expect(strip(v11)).toEqual(strip(v10));
    expect(v11.schema_version).toBe("1.1.0");
  });
  it("B08 SQL 157 = JSON 차이(31건 update, old max 조건, 사후 점검 쿼리)", () => {
    const ups = sql.match(/^update public\.biomarker_ranges set range_max = /gm) ?? [];
    expect(ups).toHaveLength(31);
    for (const [key, b] of Object.entries(v10.biomarkers)) {
      b.ranges.forEach((r, i) => {
        const n = v11.biomarkers[key].ranges[i];
        if (n.max !== r.max) {
          expect(sql).toContain(`set range_max = ${n.max} where biomarker_key = '${key}' and coalesce(sex_specific,'') = '${r.sex_specific ?? ""}' and range_min = ${r.min} and level = '${r.level}' and range_max = ${r.max};`);
        }
      });
    }
    expect(sql).toContain("lead(range_min) over (partition by biomarker_key, coalesce(sex_specific,'') order by range_min)");
  });
  it("B09 rangeIssues 단위: 틈·겹침·정상", () => {
    const mk = (a: number, b: number) => ({ biomarker_key: "X", range_min: a, range_max: b, sex_specific: null });
    expect(rangeIssues([mk(0, 10), mk(10, 20)])).toEqual([]);
    expect(rangeIssues([mk(0, 9), mk(10, 20)])[0]).toMatchObject({ kind: "gap", from: 9, to: 10 });
    expect(rangeIssues([mk(0, 11), mk(10, 20)])[0]).toMatchObject({ kind: "overlap", from: 10, to: 11 });
    expect(rangeIssues([{ ...mk(0, 9), sex_specific: "M" }, { ...mk(10, 20), sex_specific: "F" }])).toEqual([]);
  });
});
