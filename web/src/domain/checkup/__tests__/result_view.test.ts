/** 검진 결과 화면 묶음 V01~V08 · 정본 IP/integration/checkup_result_view_eval_v1.md */
import { describe, it, expect } from "vitest";
import { buildResultView, type RuleLite } from "../result_view";
import { runEngine, type Range } from "../engine";
import { rangesFromMap, type BiomarkerMap } from "../range_gaps";
import { ALLOWED_TONE_TEMPLATES } from "../compliance";
import v12json from "../biomarker_map_v1_2.json";

const v12 = v12json as unknown as BiomarkerMap & { biomarkers: Record<string, { display_name_ko: string; unit: string; category_group: string }> };
const RULES: RuleLite[] = Object.entries(v12.biomarkers).map(([k, b]) => ({ biomarker_key: k, display_name_ko: b.display_name_ko, unit: b.unit, category_group: b.category_group }));
const R = (rangesFromMap(v12) as Range[]).filter((r) => r.sex_specific === null || r.sex_specific === "M");
const JAY = { ALT: 33, AST: 33, GGT: 56, fasting_glucose: 130, HbA1c: 5.9, creatinine: 0.92, HDL: 40, LDL: 91, total_cholesterol: 186, triglyceride: 233, BMI: 26.2, blood_pressure_systolic: 130, egfr: 97 };

describe("결과 화면 묶음", () => {
  it("V01 제이 5/20 기록", () => {
    const v = buildResultView(runEngine(JAY, R), RULES);
    expect(v.summary).toEqual({ referral: 2, out: 4, in: 7, unknown: 0 });
    expect(v.sections.map((s) => [s.area, s.status])).toEqual([
      ["혈당", "referral"], ["콜레스테롤·중성지방", "referral"], ["혈압", "out"], ["체중·허리둘레", "out"]]);
    expect(v.inRange.map((i) => i.key).sort()).toEqual(["ALT", "AST", "GGT", "creatinine", "egfr"].sort());
  });
  it("V02 영역 안 순서", () => {
    const v = buildResultView(runEngine(JAY, R), RULES);
    const lipid = v.sections.find((s) => s.area === "콜레스테롤·중성지방")!;
    expect(lipid.items.map((i) => [i.key, i.status])).toEqual([["triglyceride", "referral"], ["HDL", "out"], ["total_cholesterol", "in"], ["LDL", "in"]]);
    expect(lipid.items[0]).toMatchObject({ name: "중성지방", value: 233, unit: "mg/dL", label: "의료진 상담 권장" });
  });
  it("V03 low 상태 구분", () => {
    const v = buildResultView(runEngine({ vitamin_D: 19, fasting_glucose: 65 }, R), RULES);
    expect(v.sections.find((s) => s.area === "비타민 D")?.status).toBe("out");
    expect(v.sections.find((s) => s.area === "혈당")?.status).toBe("referral");
  });
  it("V04 영역 이름·기타", () => {
    for (const s of Object.values(buildResultView(runEngine({ hemoglobin: 12.5, BMI: 27 }, R), RULES).sections)) expect(s.area).not.toMatch(/빈혈|비만|당뇨|고혈압/);
    const res = [{ biomarker_key: "ferritin", value: 10, level: "watch", label_ko: "x", functional_needs: [], tone: "관리권장", force_medical_referral: false, matched_range_id: null }];
    expect(buildResultView(res, RULES).sections[0]).toMatchObject({ area: "기타", items: [{ name: "ferritin" }] });
    const odd = [{ biomarker_key: "Q", display_name_ko: "큐", unit: "", category_group: "새영역" }];
    expect(buildResultView([{ ...res[0], biomarker_key: "Q" }], odd).sections[0].area).toBe("기타");
  });
  it("V05 안내 문구", () => {
    const v = buildResultView(runEngine(JAY, R), RULES);
    expect(v.sections[0].toneBody).toBe(ALLOWED_TONE_TEMPLATES["전문가상담권장"]);
    expect(v.sections.find((s) => s.area === "혈압")?.toneBody).toBe(ALLOWED_TONE_TEMPLATES["관리권장"]);
  });
  it("V06 미상", () => {
    const v = buildResultView([{ biomarker_key: "BMI", value: 1, level: "unknown", label_ko: null, functional_needs: [], tone: null, force_medical_referral: false, matched_range_id: null }], RULES);
    expect(v.summary.unknown).toBe(1);
    expect(v.unknown[0]).toMatchObject({ name: "체질량지수", label: "판정 기준 없음" });
    expect(v.sections).toEqual([]);
  });
  it("V07 빈 결과", () => {
    expect(buildResultView([], RULES)).toEqual({ summary: { referral: 0, out: 0, in: 0, unknown: 0 }, sections: [], inRange: [], unknown: [] });
  });
  it("V08 결정론·입력 불변", () => {
    const res = runEngine(JAY, R);
    const copy = JSON.parse(JSON.stringify(res));
    expect(buildResultView(res, RULES)).toEqual(buildResultView(res, RULES));
    expect(res).toEqual(copy);
  });
});
