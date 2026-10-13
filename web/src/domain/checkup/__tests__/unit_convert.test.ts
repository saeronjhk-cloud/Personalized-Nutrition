/** 검진 단위 환산 — U01~U19 · 평가 IP/integration/checkup_unit_convert_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertByUnitText, convertedNotice, manualUnitHint } from "../unit_convert";
import { implausibleValues } from "../input_guard";
import { parseCheckupText, matchToRules } from "../../../lib/checkupImport";
import type { BiomarkerRule } from "../../../lib/checkup_api";

const cv = (k: string, v: number, after: string) => convertByUnitText(k, v, after)?.value ?? null;

describe("U01~U10 convertByUnitText", () => {
  it("U01 공복혈당 5.5 mmol/L → 99", () => expect(cv("fasting_glucose", 5.5, " mmol/L 정상")).toBe(99));
  it("U02 총콜레스테롤 5.2 mmol/L → 201", () => expect(cv("total_cholesterol", 5.2, " mmol/L")).toBe(201));
  it("U03 HDL 1.3 → 50 · LDL 3.4 → 131 (개념 id·키 둘 다)", () => {
    expect(cv("hdl_cholesterol", 1.3, "mmol/L")).toBe(50);
    expect(cv("HDL", 1.3, "mmol/L")).toBe(50);
    expect(cv("ldl_cholesterol", 3.4, " mmol / L")).toBe(131);
  });
  it("U04 중성지방 1.7 mmol/L → 151", () => expect(cv("triglyceride", 1.7, " mmol/L")).toBe(151));
  it("U05 크레아티닌 80 μmol/L·umol/L·µmol/L → 0.9", () => {
    for (const u of [" μmol/L", " umol/L", " µmol/L"]) expect(cv("creatinine", 80, u)).toBe(0.9);
  });
  it("U06 혈색소 140 g/L → 14", () => expect(cv("hemoglobin", 140, " g/L")).toBe(14));
  it("U07 당화혈색소 48 mmol/mol → 6.5", () => {
    expect(cv("hba1c", 48, " mmol/mol")).toBe(6.5);
    expect(cv("HbA1c", 48, "mmol/mol")).toBe(6.5);
  });
  it("U08 기준 단위 표기 → 변환 없음", () => {
    expect(convertByUnitText("fasting_glucose", 95, " mg/dL 정상A")).toBeNull();
    expect(convertByUnitText("hemoglobin", 14, " g/dL")).toBeNull();
    expect(convertByUnitText("hba1c", 5.6, " %")).toBeNull();
    expect(convertByUnitText("creatinine", 0.9, " mg/dL")).toBeNull();
  });
  it("U09 단위 없음·모르는 항목 → 변환 없음", () => {
    expect(convertByUnitText("fasting_glucose", 95, " 정상")).toBeNull();
    expect(convertByUnitText("fasting_glucose", 95, null)).toBeNull();
    expect(convertByUnitText("waist", 80, " mmol/L")).toBeNull();
  });
  it("U10 혈색소 14.2 g/dL 를 g/L 로 오인하지 않음", () => expect(convertByUnitText("hemoglobin", 14.2, " g/dL")).toBeNull());
});

describe("U11~U15 PDF 파싱", () => {
  const item = (text: string, label: string) => parseCheckupText(text).items.find((i) => i.label === label);
  it("U11 공복혈당 5.5 mmol/L → 99 + conversion", () => {
    const it2 = item("검진일자 2026.05.20\n공복혈당 5.5 mmol/L 정상", "fasting_glucose");
    expect(it2?.value).toBe(99);
    expect(it2?.conversion?.from).toEqual({ value: 5.5, unit: "mmol/L" });
  });
  it("U12 혈청크레아티닌 80 μmol/L → 0.9", () => {
    const it2 = item("혈청크레아티닌 80 μmol/L", "creatinine");
    expect(it2?.value).toBe(0.9);
    expect(it2?.conversion?.from.unit).toBe("μmol/L");
  });
  it("U13 NHIS 기존 표기 회귀 — 95 mg/dL 그대로, conversion 없음", () => {
    const it2 = item("공복혈당 95 mg/dL 정상A", "fasting_glucose");
    expect(it2?.value).toBe(95);
    expect(it2?.conversion).toBeUndefined();
  });
  it("U14 혈색소 140 g/L → 14", () => expect(item("혈색소 140 g/L", "hemoglobin")?.value).toBe(14));
  it("U15 환산 후에도 범위 밖이면 버림(공복혈당 50 mmol/L → 901)", () =>
    expect(item("공복혈당 50 mmol/L", "fasting_glucose")).toBeUndefined());
  it("matchToRules 가 환산 항목을 표시명과 함께 돌려줌", () => {
    const rules = [{ biomarker_key: "fasting_glucose", display_name_ko: "공복혈당", unit: "mg/dL", category_group: "당대사", inverted: false, note: null }] as unknown as BiomarkerRule[];
    const r = matchToRules(parseCheckupText("공복혈당 5.5 mmol/L"), rules);
    expect(r.matched.fasting_glucose).toBe("99");
    expect(r.converted).toEqual([{ key: "fasting_glucose", name: "공복혈당", conversion: { value: 99, baseUnit: "mg/dL", from: { value: 5.5, unit: "mmol/L" } } }]);
  });
});

describe("U16~U19", () => {
  it("U16 안내 문구", () => {
    const c = convertByUnitText("fasting_glucose", 5.5, " mmol/L")!;
    expect(convertedNotice([{ name: "공복혈당", conversion: c }])).toBe("단위를 바꿔 넣었어요: 공복혈당 5.5 mmol/L → 99 mg/dL. 결과지와 맞는지 확인해 주세요.");
    expect(convertedNotice([])).toBeNull();
  });
  it("U17 직접 입력 — 범위 밖 값에 환산 안내(자동 변경 없음)", () => {
    const hints = Object.fromEntries(
      implausibleValues({ total_cholesterol: 5.2, triglyceride: 1.7, creatinine: 80, hemoglobin: 140, HbA1c: 48 }).map((x) => [x.key, x.hint]),
    );
    expect(hints.total_cholesterol).toContain("mmol/L 로 적으셨다면 mg/dL 로 약 201");
    expect(hints.triglyceride).toContain("약 151");
    expect(hints.creatinine).toContain("μmol/L 로 적으셨다면 mg/dL 로 약 0.9");
    expect(hints.hemoglobin).toContain("g/L 로 적으셨다면 g/dL 로 약 14");
    expect(hints.HbA1c).toContain("mmol/mol 로 적으셨다면 % 로 약 6.5");
    // 값 자체는 바꾸지 않음
    expect(implausibleValues({ total_cholesterol: 5.2 })[0].value).toBe(5.2);
  });
  it("U18 정상값엔 경고·안내 없음 · 혈당·비타민D 기존 안내 유지", () => {
    expect(implausibleValues({ total_cholesterol: 190, triglyceride: 120, creatinine: 0.9, hemoglobin: 14, HbA1c: 5.6 })).toEqual([]);
    expect(implausibleValues({ fasting_glucose: 5.5 })[0].hint).toBe("mmol/L 로 적으셨다면 18을 곱한 값(mg/dL)을 적어 주세요.");
    expect(manualUnitHint("total_cholesterol", 190)).toBeNull();
  });
  it("U19 배선 — BiomarkerForm 이 convertedNotice 를 불러오기 안내에 붙임", () => {
    const s = readFileSync(resolve(__dirname, "../../../components/checkup/BiomarkerForm.tsx"), "utf-8");
    expect(s).toContain("const { matched, unmatchedLabels, converted } = matchToRules(parsed, rules);");
    expect(s).toContain("convertedNotice(converted)");
  });
});
