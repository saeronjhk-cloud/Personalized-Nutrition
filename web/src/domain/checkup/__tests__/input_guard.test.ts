/** 검진 입력 가드 P01~P09·S01~S02 · 정본 IP/integration/checkup_input_guard_eval_v1.md */
import { describe, it, expect } from "vitest";
import { PLAUSIBLE_BOUNDS, implausibleValues, implausibleMessage, sameDateRecord, sameDateMessage } from "../input_guard";
import { rangesFromMap, type BiomarkerMap } from "../range_gaps";
import v11json from "../biomarker_map_v1_3.json"; // v1.3 = v1.2 + 요단백

const v11 = v11json as unknown as BiomarkerMap;

describe("검진 입력 가드", () => {
  it("P01 판정표 v1.3 19항목 1:1", () => {
    expect(Object.keys(PLAUSIBLE_BOUNDS).sort()).toEqual(Object.keys(v11.biomarkers).sort());
  });
  it("P02 BMI 83 → 체중 힌트", () => {
    const r = implausibleValues({ BMI: 83 });
    expect(r).toHaveLength(1);
    expect(r[0].hint).toContain("체중(kg)이 아니라 체질량지수");
  });
  it("P03 제이 실제 값 28개 → 0건", () => {
    const recs: Record<string, number>[] = [
      { ALT: 33, AST: 33, GGT: 56, fasting_glucose: 130, HbA1c: 5.9, creatinine: 0.92, HDL: 40, LDL: 91, total_cholesterol: 186, triglyceride: 233, BMI: 26.2, blood_pressure_systolic: 130 },
      { AST: 31, fasting_glucose: 104, HbA1c: 5.9, creatinine: 0.83, total_cholesterol: 165, BMI: 26, blood_pressure_systolic: 128, ALT: 27 },
      { ALT: 27, AST: 31, fasting_glucose: 104, HbA1c: 5.9, creatinine: 0.83, total_cholesterol: 165, blood_pressure_systolic: 128 },
    ];
    for (const r of recs) expect(implausibleValues(r)).toEqual([]);
  });
  it("P04 경계 포함", () => {
    expect(implausibleValues({ BMI: 10 })).toEqual([]);
    expect(implausibleValues({ BMI: 70 })).toEqual([]);
    expect(implausibleValues({ BMI: 9.99 })).toHaveLength(1);
    expect(implausibleValues({ BMI: 70.01 })).toHaveLength(1);
  });
  it("P05 공복혈당 mmol/L 오입력", () => {
    expect(implausibleValues({ fasting_glucose: 5.5 })[0].hint).toContain("18을 곱한");
  });
  it("P06 비타민D nmol/L 오입력", () => {
    expect(implausibleValues({ vitamin_D: 250 })[0].hint).toContain("2.5로 나눈");
  });
  it("P07 판정 구간의 판정 가능 경계값은 모두 가능 범위 안", () => {
    const all = rangesFromMap(v11);
    for (const r of all) {
      const [lo, hi] = PLAUSIBLE_BOUNDS[r.biomarker_key];
      const group = all.filter((x) => x.biomarker_key === r.biomarker_key && x.sex_specific === r.sex_specific);
      const isTop = r.range_min === Math.max(...group.map((x) => x.range_min));
      // 열린 끝 제외: 맨 아래 min 0 · 맨 위 구간의 max(99·999·9999 표기). 비타민D 100 같은 실제 상한은 검사됨
      for (const v of isTop && r.range_max >= 99 ? [r.range_min] : [r.range_min, r.range_max]) {
        if (v <= 0) continue;
        expect([r.biomarker_key, v, v >= lo && v <= hi]).toEqual([r.biomarker_key, v, true]);
      }
    }
  });
  it("P08 모르는 키 통과", () => {
    expect(implausibleValues({ ferritin: 99999 })).toEqual([]);
  });
  it("P09 문구 고정", () => {
    expect(implausibleMessage(implausibleValues({ BMI: 83 })[0], "체질량지수", "kg/m²"))
      .toBe("체질량지수 83 kg/m² — 보통 10~70 사이 값이에요. 다른 칸이나 단위로 적지 않았는지 확인해 주세요. 체중(kg)이 아니라 체질량지수예요. 결과지의 ‘체질량지수’ 값을 적어 주세요.");
    expect(sameDateMessage("2026-05-27")).toBe("2026-05-27 검진 기록이 이미 있어요. 고치려면 기록 관리에서 수정해 주세요.");
  });
  it("S01·S02 같은 날짜", () => {
    const recs = [{ id: "a", recorded_date: "2026-05-27" }, { id: "b", recorded_date: "2026-05-20" }];
    expect(sameDateRecord(recs, "2026-05-27")?.id).toBe("a");
    expect(sameDateRecord(recs, "2026-06-01")).toBeNull();
    expect(sameDateRecord(recs, "2026-05-27", "a")).toBeNull();
  });
});
