/** 검진 결과 화면 다듬기 v2 T01~T10 · O01~O05 · 정본 IP/integration/checkup_result_view_eval_v2.md */
import { describe, it, expect } from "vitest";
import { buildResultView, AREA_ORDER, type RuleLite } from "../result_view";
import { runEngine, type Range } from "../engine";
import { rangesFromMap, type BiomarkerMap } from "../range_gaps";
import { ALLOWED_TONE_TEMPLATES, BANNED_WORDS, resolveToneBody } from "../compliance";
import v13json from "../biomarker_map_v1_3.json";

const v13 = v13json as unknown as BiomarkerMap & { biomarkers: Record<string, { display_name_ko: string; unit: string; category_group: string }> };
const RULES: RuleLite[] = Object.entries(v13.biomarkers).map(([k, b]) => ({ biomarker_key: k, display_name_ko: b.display_name_ko, unit: b.unit, category_group: b.category_group }));
const REV = [...RULES].reverse();
const ALL = rangesFromMap(v13) as Range[];
const M = ALL.filter((r) => r.sex_specific === null || r.sex_specific === "M");
const LIFE = "참고범위를 벗어난 수치가 있습니다. 생활 습관을 점검하고, 다음 검진에서 다시 확인해 보세요.";
const JAY = { ALT: 33, AST: 33, GGT: 56, fasting_glucose: 130, HbA1c: 5.9, creatinine: 0.92, HDL: 40, LDL: 91, total_cholesterol: 186, triglyceride: 233, BMI: 26.2, blood_pressure_systolic: 130, egfr: 97 };
const sec = (input: Record<string, number>, area: string, rules = RULES) => buildResultView(runEngine(input, M), rules).sections.find((s) => s.area === area)!;

describe("v2 톤 — 기능성 없는 범위 밖", () => {
  it("T01 요단백 ±", () => expect(sec({ urine_protein: 0.5 }, "신장")).toMatchObject({ status: "out", toneBody: LIFE }));
  it("T02 저혈압", () => expect(sec({ blood_pressure_systolic: 85, blood_pressure_diastolic: 55 }, "혈압")).toMatchObject({ status: "out", toneBody: LIFE }));
  it("T03 혈색소 높음(남 17)", () => expect(sec({ hemoglobin: 17 }, "혈색소")).toMatchObject({ status: "out", toneBody: LIFE }));
  it("T04 저체중 BMI 17", () => expect(sec({ BMI: 17 }, "체중·허리둘레")).toMatchObject({ status: "out", toneBody: LIFE }));
  it("T05 수축기 130 = 관리권장(현행)", () => expect(sec({ blood_pressure_systolic: 130 }, "혈압").toneBody).toBe(ALLOWED_TONE_TEMPLATES["관리권장"]));
  it("T06 섞임 = 관리권장", () => expect(sec({ blood_pressure_systolic: 130, blood_pressure_diastolic: 55 }, "혈압").toneBody).toBe(ALLOWED_TONE_TEMPLATES["관리권장"]));
  it("T07 혈색소 12.5 = 관리권장", () => expect(sec({ hemoglobin: 12.5 }, "혈색소").toneBody).toBe(ALLOWED_TONE_TEMPLATES["관리권장"]));
  it("T08 요단백 +1 = 상담", () => expect(sec({ urine_protein: 1 }, "신장")).toMatchObject({ status: "referral", toneBody: ALLOWED_TONE_TEMPLATES["전문가상담권장"] }));
  it("T09 문구 준법", () => {
    expect(ALLOWED_TONE_TEMPLATES["생활관리권장"]).toBe(LIFE);
    for (const w of BANNED_WORDS) expect(LIFE).not.toContain(w);
    expect(LIFE).not.toMatch(/영양제|기능성|식약처/);
    expect(resolveToneBody("생활관리권장")).toBe(LIFE);
  });
  it("T10 제이 5/20 회귀 0", () => {
    const v = buildResultView(runEngine(JAY, M), RULES);
    expect(v.summary).toEqual({ referral: 2, out: 4, in: 7, unknown: 0 });
    expect(v.sections.map((s) => [s.area, s.status])).toEqual([["혈당", "referral"], ["콜레스테롤·중성지방", "referral"], ["혈압", "out"], ["체중·허리둘레", "out"]]);
    expect(v.sections.find((s) => s.area === "혈압")!.toneBody).toBe(ALLOWED_TONE_TEMPLATES["관리권장"]);
    expect(v.sections.find((s) => s.area === "체중·허리둘레")!.toneBody).toBe(ALLOWED_TONE_TEMPLATES["관리권장"]);
  });
});

describe("v2 영역 순서 고정", () => {
  it("O01 rules 뒤집어도 같은 순서", () => {
    expect(buildResultView(runEngine(JAY, M), REV).sections.map((s) => s.area)).toEqual(["혈당", "콜레스테롤·중성지방", "혈압", "체중·허리둘레"]);
  });
  it("O02 범위 밖 3영역", () => {
    const v = buildResultView(runEngine({ vitamin_D: 25, hemoglobin: 17, ALT: 40 }, M), REV);
    expect(v.sections.map((s) => s.area)).toEqual(["간 수치", "혈색소", "비타민 D"]);
  });
  it("O03 상태 우선", () => {
    const v = buildResultView(runEngine({ fasting_glucose: 110, urine_protein: 1 }, M), RULES);
    expect(v.sections.map((s) => [s.area, s.status])).toEqual([["신장", "referral"], ["혈당", "out"]]);
  });
  it("O04 범위 내 묶음 순서", () => {
    const v = buildResultView(runEngine({ ALT: 20, LDL: 100, fasting_glucose: 90 }, M), REV);
    expect(v.inRange.map((i) => i.key)).toEqual(["fasting_glucose", "LDL", "ALT"]);
  });
  it("O05 기타는 맨 끝", () => {
    expect(AREA_ORDER[AREA_ORDER.length - 1]).toBe("기타");
    const res = [
      { biomarker_key: "ferritin", value: 10, level: "watch", label_ko: "x", functional_needs: [], tone: "관리권장", force_medical_referral: false, matched_range_id: null },
      ...runEngine({ vitamin_D: 25 }, M),
    ];
    expect(buildResultView(res, RULES).sections.map((s) => s.area)).toEqual(["비타민 D", "기타"]);
  });
});
