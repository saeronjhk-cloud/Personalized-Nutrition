import { describe, it, expect } from "vitest";
import { runEngine, ENGINE_VERSION, type Range } from "../engine";

function mockRange(partial: Omit<Range, "sex_specific"> & { sex_specific?: string | null }): Range {
  return {
    sex_specific: null,
    ...partial,
  };
}

/** In-memory ranges mirroring biomarker_ranges core bands (range_min <= value < range_max). */
const MOCK_RANGES: Range[] = [
  // HbA1c
  mockRange({ id: "hba1c-n", biomarker_key: "HbA1c", range_min: 0, range_max: 5.7, level: "normal", label_ko: "정상", functional_needs: ["식후 혈당 상승 억제"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "hba1c-w", biomarker_key: "HbA1c", range_min: 5.7, range_max: 6.5, level: "watch", label_ko: "당뇨 전단계", functional_needs: ["식후 혈당 상승 억제"], tone: "관리권장", force_medical_referral: false, sort_order: 2 }),
  mockRange({ id: "hba1c-h", biomarker_key: "HbA1c", range_min: 6.5, range_max: 20, level: "high", label_ko: "당뇨 의심", functional_needs: ["식후 혈당 상승 억제"], tone: "전문가상담권장", force_medical_referral: true, sort_order: 3 }),
  // LDL
  mockRange({ id: "ldl-n", biomarker_key: "LDL", range_min: 0, range_max: 130, level: "normal", label_ko: "정상", functional_needs: ["혈중 콜레스테롤 개선"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "ldl-w", biomarker_key: "LDL", range_min: 130, range_max: 160, level: "watch", label_ko: "경계", functional_needs: ["혈중 콜레스테롤 개선"], tone: "관리권장", force_medical_referral: false, sort_order: 2 }),
  mockRange({ id: "ldl-h", biomarker_key: "LDL", range_min: 160, range_max: 500, level: "high", label_ko: "높음", functional_needs: ["혈중 콜레스테롤 개선"], tone: "전문가상담권장", force_medical_referral: true, sort_order: 3 }),
  // total_cholesterol
  mockRange({ id: "tc-n", biomarker_key: "total_cholesterol", range_min: 0, range_max: 200, level: "normal", label_ko: "정상", functional_needs: ["혈중 콜레스테롤 개선"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "tc-w", biomarker_key: "total_cholesterol", range_min: 200, range_max: 240, level: "watch", label_ko: "경계", functional_needs: ["혈중 콜레스테롤 개선"], tone: "관리권장", force_medical_referral: false, sort_order: 2 }),
  mockRange({ id: "tc-h", biomarker_key: "total_cholesterol", range_min: 240, range_max: 500, level: "high", label_ko: "높음", functional_needs: ["혈중 콜레스테롤 개선"], tone: "전문가상담권장", force_medical_referral: false, sort_order: 3 }),
  // fasting_glucose
  mockRange({ id: "fg-n", biomarker_key: "fasting_glucose", range_min: 70, range_max: 100, level: "normal", label_ko: "정상", functional_needs: ["식후 혈당 상승 억제"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "fg-w", biomarker_key: "fasting_glucose", range_min: 100, range_max: 126, level: "watch", label_ko: "공복혈당장애", functional_needs: ["식후 혈당 상승 억제"], tone: "관리권장", force_medical_referral: false, sort_order: 2 }),
  mockRange({ id: "fg-h", biomarker_key: "fasting_glucose", range_min: 126, range_max: 500, level: "high", label_ko: "당뇨 의심", functional_needs: ["식후 혈당 상승 억제"], tone: "전문가상담권장", force_medical_referral: true, sort_order: 3 }),
  // vitamin_D
  mockRange({ id: "vd-l", biomarker_key: "vitamin_D", range_min: 0, range_max: 20, level: "low", label_ko: "결핍", functional_needs: ["뼈 건강"], tone: "관리권장", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "vd-n", biomarker_key: "vitamin_D", range_min: 20, range_max: 30, level: "normal", label_ko: "정상", functional_needs: ["뼈 건강"], tone: "유지", force_medical_referral: false, sort_order: 2 }),
  mockRange({ id: "vd-o", biomarker_key: "vitamin_D", range_min: 30, range_max: 100, level: "normal", label_ko: "충분", functional_needs: ["뼈 건강"], tone: "유지", force_medical_referral: false, sort_order: 3 }),
  // blood_pressure_systolic
  mockRange({ id: "bps-n", biomarker_key: "blood_pressure_systolic", range_min: 90, range_max: 120, level: "normal", label_ko: "정상", functional_needs: ["혈압 관리"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "bps-w", biomarker_key: "blood_pressure_systolic", range_min: 120, range_max: 140, level: "watch", label_ko: "주의", functional_needs: ["혈압 관리"], tone: "관리권장", force_medical_referral: false, sort_order: 2 }),
  mockRange({ id: "bps-h", biomarker_key: "blood_pressure_systolic", range_min: 140, range_max: 250, level: "high", label_ko: "고혈압", functional_needs: ["혈압 관리"], tone: "전문가상담권장", force_medical_referral: true, sort_order: 3 }),
  // triglyceride
  mockRange({ id: "tg-n", biomarker_key: "triglyceride", range_min: 0, range_max: 150, level: "normal", label_ko: "정상", functional_needs: ["혈중 지질 개선"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "tg-w", biomarker_key: "triglyceride", range_min: 150, range_max: 200, level: "watch", label_ko: "경계", functional_needs: ["혈중 지질 개선"], tone: "관리권장", force_medical_referral: false, sort_order: 2 }),
  mockRange({ id: "tg-h", biomarker_key: "triglyceride", range_min: 200, range_max: 1000, level: "high", label_ko: "높음", functional_needs: ["혈중 지질 개선"], tone: "전문가상담권장", force_medical_referral: false, sort_order: 3 }),
  // HDL (inverted — low HDL is bad)
  mockRange({ id: "hdl-l", biomarker_key: "HDL", range_min: 0, range_max: 40, level: "low", label_ko: "낮음", functional_needs: ["혈중 콜레스테롤 개선"], tone: "관리권장", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "hdl-n", biomarker_key: "HDL", range_min: 40, range_max: 200, level: "normal", label_ko: "정상", functional_needs: ["혈중 콜레스테롤 개선"], tone: "유지", force_medical_referral: false, sort_order: 2 }),
  // TSH
  mockRange({ id: "tsh-n", biomarker_key: "TSH", range_min: 0.4, range_max: 4.0, level: "normal", label_ko: "정상", functional_needs: ["갑상선 기능"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "tsh-h", biomarker_key: "TSH", range_min: 4.0, range_max: 20, level: "high", label_ko: "높음", functional_needs: ["갑상선 기능"], tone: "전문가상담권장", force_medical_referral: false, sort_order: 2 }),
  // ferritin
  mockRange({ id: "fer-l", biomarker_key: "ferritin", range_min: 0, range_max: 15, level: "low", label_ko: "결핍", functional_needs: ["철분 보충"], tone: "관리권장", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "fer-n", biomarker_key: "ferritin", range_min: 15, range_max: 200, level: "normal", label_ko: "정상", functional_needs: ["철분 보충"], tone: "유지", force_medical_referral: false, sort_order: 2 }),
  // AST / ALT / GGT
  mockRange({ id: "ast-n", biomarker_key: "AST", range_min: 0, range_max: 40, level: "normal", label_ko: "정상", functional_needs: ["간 건강"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "ast-h", biomarker_key: "AST", range_min: 40, range_max: 500, level: "high", label_ko: "높음", functional_needs: ["간 건강"], tone: "전문가상담권장", force_medical_referral: false, sort_order: 2 }),
  mockRange({ id: "alt-n", biomarker_key: "ALT", range_min: 0, range_max: 35, level: "normal", label_ko: "정상", functional_needs: ["간 건강"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "alt-h", biomarker_key: "ALT", range_min: 35, range_max: 500, level: "high", label_ko: "높음", functional_needs: ["간 건강"], tone: "전문가상담권장", force_medical_referral: false, sort_order: 2 }),
  mockRange({ id: "ggt-n", biomarker_key: "GGT", range_min: 0, range_max: 50, level: "normal", label_ko: "정상", functional_needs: ["간 건강"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "ggt-h", biomarker_key: "GGT", range_min: 50, range_max: 500, level: "high", label_ko: "높음", functional_needs: ["간 건강"], tone: "관리권장", force_medical_referral: false, sort_order: 2 }),
  // creatinine
  mockRange({ id: "cre-n", biomarker_key: "creatinine", range_min: 0, range_max: 1.2, level: "normal", label_ko: "정상", functional_needs: ["신장 기능"], tone: "유지", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "cre-h", biomarker_key: "creatinine", range_min: 1.2, range_max: 10, level: "high", label_ko: "높음", functional_needs: ["신장 기능"], tone: "전문가상담권장", force_medical_referral: false, sort_order: 2 }),
  // hemoglobin
  mockRange({ id: "hb-l", biomarker_key: "hemoglobin", range_min: 0, range_max: 12, level: "low", label_ko: "빈혈", functional_needs: ["철분 보충"], tone: "관리권장", force_medical_referral: false, sort_order: 1 }),
  mockRange({ id: "hb-n", biomarker_key: "hemoglobin", range_min: 12, range_max: 18, level: "normal", label_ko: "정상", functional_needs: ["철분 보충"], tone: "유지", force_medical_referral: false, sort_order: 2 }),
];

function one(input: Record<string, number>, key: string) {
  const results = runEngine(input, MOCK_RANGES);
  const row = results.find((r) => r.biomarker_key === key);
  expect(row).toBeDefined();
  return row!;
}

describe("runEngine — meta", () => {
  it("ENGINE_VERSION is defined", () => {
    expect(ENGINE_VERSION).toBe("1.0.0");
  });
});

describe("runEngine — biomarker_ranges 매칭", () => {
  it("HbA1c 5.5 → normal", () => {
    const row = one({ HbA1c: 5.5 }, "HbA1c");
    expect(row.level).toBe("normal");
    expect(row.functional_needs).toContain("식후 혈당 상승 억제");
  });

  it("HbA1c 5.9 → watch (당뇨 전단계)", () => {
    const row = one({ HbA1c: 5.9 }, "HbA1c");
    expect(row.level).toBe("watch");
    expect(row.label_ko).toBe("당뇨 전단계");
  });

  it("HbA1c 6.5 → high + force_medical_referral", () => {
    const row = one({ HbA1c: 6.5 }, "HbA1c");
    expect(row.level).toBe("high");
    expect(row.force_medical_referral).toBe(true);
  });

  it("LDL 100 → normal", () => {
    expect(one({ LDL: 100 }, "LDL").level).toBe("normal");
  });

  it("LDL 130 → watch (경계)", () => {
    expect(one({ LDL: 130 }, "LDL").level).toBe("watch");
  });

  it("LDL 170 → high", () => {
    expect(one({ LDL: 170 }, "LDL").level).toBe("high");
  });

  it("total_cholesterol 220 → watch", () => {
    expect(one({ total_cholesterol: 220 }, "total_cholesterol").level).toBe("watch");
  });

  it("fasting_glucose 90 → normal", () => {
    expect(one({ fasting_glucose: 90 }, "fasting_glucose").level).toBe("normal");
  });

  it("fasting_glucose 110 → watch", () => {
    expect(one({ fasting_glucose: 110 }, "fasting_glucose").level).toBe("watch");
  });

  it("vitamin_D 15 → low (결핍)", () => {
    const row = one({ vitamin_D: 15 }, "vitamin_D");
    expect(row.level).toBe("low");
    expect(row.functional_needs).toContain("뼈 건강");
  });

  it("vitamin_D 35 → normal (충분)", () => {
    expect(one({ vitamin_D: 35 }, "vitamin_D").level).toBe("normal");
  });

  it("blood_pressure_systolic 115 → normal", () => {
    expect(one({ blood_pressure_systolic: 115 }, "blood_pressure_systolic").level).toBe("normal");
  });

  it("blood_pressure_systolic 145 → high", () => {
    const row = one({ blood_pressure_systolic: 145 }, "blood_pressure_systolic");
    expect(row.level).toBe("high");
    expect(row.force_medical_referral).toBe(true);
  });

  it("triglyceride 120 → normal", () => {
    expect(one({ triglyceride: 120 }, "triglyceride").level).toBe("normal");
  });

  it("triglyceride 250 → high", () => {
    expect(one({ triglyceride: 250 }, "triglyceride").level).toBe("high");
  });

  it("HDL 35 → low", () => {
    expect(one({ HDL: 35 }, "HDL").level).toBe("low");
  });

  it("TSH 2.5 → normal", () => {
    expect(one({ TSH: 2.5 }, "TSH").level).toBe("normal");
  });

  it("ferritin 10 → low", () => {
    expect(one({ ferritin: 10 }, "ferritin").level).toBe("low");
  });

  it("AST 55 → high", () => {
    expect(one({ AST: 55 }, "AST").level).toBe("high");
  });

  it("ALT 50 → high", () => {
    expect(one({ ALT: 50 }, "ALT").level).toBe("high");
  });

  it("GGT 60 → high", () => {
    expect(one({ GGT: 60 }, "GGT").level).toBe("high");
  });

  it("creatinine 1.5 → high", () => {
    expect(one({ creatinine: 1.5 }, "creatinine").level).toBe("high");
  });

  it("hemoglobin 11 → low", () => {
    expect(one({ hemoglobin: 11 }, "hemoglobin").level).toBe("low");
  });
});

describe("runEngine — edge cases", () => {
  it("빈 input → 빈 배열", () => {
    expect(runEngine({}, MOCK_RANGES)).toEqual([]);
  });

  it("미정의 biomarker → level unknown", () => {
    const row = one({ unknown_marker: 42 }, "unknown_marker");
    expect(row.level).toBe("unknown");
    expect(row.matched_range_id).toBeNull();
  });

  it("NaN value → 결과에서 제외", () => {
    const results = runEngine({ HbA1c: Number.NaN }, MOCK_RANGES);
    expect(results).toHaveLength(0);
  });

  it("범위 하한 (range_min) → 매칭", () => {
    const row = one({ LDL: 130 }, "LDL");
    expect(row.level).toBe("watch");
    expect(row.matched_range_id).toBe("ldl-w");
  });

  it("범위 상한 (value === range_max) → 해당 구간 미매칭", () => {
    const results = runEngine({ HbA1c: 6.5 }, MOCK_RANGES);
    const row = results.find((r) => r.biomarker_key === "HbA1c")!;
    expect(row.level).toBe("high");
    expect(row.matched_range_id).toBe("hba1c-h");
  });

  it("복수 biomarker 동시 분석", () => {
    const results = runEngine({ HbA1c: 5.5, LDL: 170 }, MOCK_RANGES);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.biomarker_key === "HbA1c")?.level).toBe("normal");
    expect(results.find((r) => r.biomarker_key === "LDL")?.level).toBe("high");
  });
});
