/** 요단백 P01~P08·R01~R03 · 정본 IP/integration/checkup_urine_protein_eval_v1.md */
import { describe, it, expect } from "vitest";
import { parseUrineProtein, formatBiomarkerValue, isOrdinalKey } from "../urine_protein";
import { runEngine, type Range } from "../engine";
import { rangeIssues, rangesFromMap } from "../range_gaps";
import v13 from "../biomarker_map_v1_3.json";
import v12 from "../biomarker_map_v1_2.json";

describe("요단백 기호 해석", () => {
  const cases: [string[], number | null][] = [
    [["음성", "-", "(-)", "neg", "Negative", "음성(-)"], 0],
    [["±", "+-", "+/-", "약양성", "약양성(±)", "trace"], 0.5],
    [["+1", "1+", "+", "양성(+1)"], 1],
    [["+2", "2+", "++"], 2],
    [["+3", "3+", "+++"], 3],
    [["+4", "4+", "++++"], 4],
    [["양성"], 1],
    [["정상", "95", "", "abc"], null],
  ];
  for (const [inputs, want] of cases) {
    it(`P ${inputs.join(",")} → ${want}`, () => { for (const s of inputs) expect(parseUrineProtein(s), s).toBe(want); });
  }
});

describe("요단백 표시", () => {
  it("P07", () => {
    expect([0, 0.5, 1, 2, 3, 4].map((v) => formatBiomarkerValue("urine_protein", v)))
      .toEqual(["음성(-)", "약양성(±)", "양성(+1)", "양성(+2)", "양성(+3)", "양성(+4)"]);
  });
  it("P08", () => {
    expect(formatBiomarkerValue("urine_protein", 1.7)).toBe("1.7");
    expect(formatBiomarkerValue("fasting_glucose", 126)).toBe("126");
    expect(isOrdinalKey("urine_protein")).toBe(true);
    expect(isOrdinalKey("LDL")).toBe(false);
  });
});

describe("판정표 v1.3", () => {
  const ranges: Range[] = (v13.biomarkers.urine_protein.ranges as any[]).map((r, i) => ({
    id: `u${i}`, biomarker_key: "urine_protein", range_min: r.min, range_max: r.max, level: r.level, label_ko: r.label_ko,
    functional_needs: r.functional_needs, tone: r.tone, force_medical_referral: !!r.force_medical_referral, sex_specific: null, sort_order: i,
  }));
  const judge = (v: number) => runEngine({ urine_protein: v }, ranges)[0];
  it("R01", () => {
    expect(judge(0).label_ko).toBe("참고범위 내");
    expect(judge(0.5).label_ko).toBe("참고범위보다 높음");
    expect(judge(0.5).force_medical_referral).toBe(false);
    for (const v of [1, 4]) { expect(judge(v).label_ko).toBe("의료진 상담 권장"); expect(judge(v).force_medical_referral).toBe(true); }
  });
  it("R02 틈 0 · 기존 18항목 불변", () => {
    expect(rangeIssues(rangesFromMap(v13 as any))).toEqual([]);
    const { urine_protein, ...rest } = v13.biomarkers as Record<string, unknown>;
    expect(urine_protein).toBeDefined();
    expect(rest).toEqual(v12.biomarkers);
    expect(Object.keys(v13.biomarkers)).toHaveLength(19);
  });
  it("R03 추천 연결 없음 · 신장기능", () => {
    expect(v13.biomarkers.urine_protein.category_group).toBe("신장기능");
    for (const r of v13.biomarkers.urine_protein.ranges) expect(r.functional_needs).toEqual([]);
  });
});

import { implausibleValues } from "../input_guard";
describe("요단백 입력 가드", () => {
  it("I01 코드만 허용", () => {
    for (const v of [0, 0.5, 1, 2, 3, 4]) expect(implausibleValues({ urine_protein: v })).toEqual([]);
    for (const v of [0.7, 5]) {
      const r = implausibleValues({ urine_protein: v });
      expect(r).toHaveLength(1);
      expect(r[0].hint).toContain("골라");
    }
  });
});
