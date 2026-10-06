/** 요단백 PDF 가져오기 I02·I03 · 정본 IP/integration/checkup_urine_protein_eval_v1.md */
import { describe, it, expect } from "vitest";
import { parseCheckupText, matchToRules } from "../checkupImport";
import type { BiomarkerRule } from "../checkup_api";

const RULES = [
  { biomarker_key: "urine_protein", display_name_ko: "요단백", unit: "", category_group: "신장기능", inverted: false, note: null },
  { biomarker_key: "fasting_glucose", display_name_ko: "공복혈당", unit: "mg/dL", category_group: "당대사", inverted: false, note: null },
] as unknown as BiomarkerRule[];
const up = (text: string) => matchToRules(parseCheckupText(text), RULES).matched.urine_protein;

describe("요단백 PDF 가져오기", () => {
  it("I02 기호 → 코드", () => {
    expect(up("요단백 음성 - 정상A")).toBe("0");
    expect(up("요단백 약양성(±) 정상B")).toBe("0.5");
    expect(up("요 단백 2+ 질환의심")).toBe("2");
    expect(up("요단백 정상")).toBeUndefined();
  });
  it("I03 요당·단백질은 요단백 아님", () => {
    expect(up("요당 음성\n총단백질 7.0 g/dL")).toBeUndefined();
    expect(matchToRules(parseCheckupText("요단백 음성\n공복혈당 95 mg/dL"), RULES).matched).toEqual({ urine_protein: "0", fasting_glucose: "95" });
  });
});
