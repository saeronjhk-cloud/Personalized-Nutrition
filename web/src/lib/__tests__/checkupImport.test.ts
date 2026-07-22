// =============================================================================
// checkupImport 평가 셋 (Eval-First — 세션34)
// NHIS 일반건강검진 결과통보서의 텍스트 추출 결과를 모사한 픽스처 12케이스.
// 실제 PDF 검증 전까지 이 셋이 v1 의 기준선이다.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  normalizeLabel,
  parseCheckupDate,
  parseCheckupText,
  matchToRules,
} from "../checkupImport";
import type { BiomarkerRule } from "../checkup_api";

const rule = (key: string, name: string): BiomarkerRule => ({
  biomarker_key: key,
  display_name_ko: name,
  unit: "",
  category_group: "테스트",
  inverted: false,
  note: null,
});

// engine.test.ts 에서 확인된 실제 키 + display_name_ko 가정
const RULES: BiomarkerRule[] = [
  rule("fasting_glucose", "공복혈당"),
  rule("total_cholesterol", "총콜레스테롤"),
  rule("triglyceride", "중성지방"),
  rule("hemoglobin", "혈색소"),
  rule("creatinine", "크레아티닌"),
  rule("blood_pressure_systolic", "수축기 혈압"),
  rule("blood_pressure_diastolic", "이완기 혈압"),
  rule("ferritin", "페리틴"),
];

describe("normalizeLabel", () => {
  it("케이스1: 공백·괄호·전각을 흡수한다", () => {
    expect(normalizeLabel("HDL - 콜레스테롤 (mg/dL)")).toBe(
      normalizeLabel("HDL콜레스테롤mgdL"),
    );
    expect(normalizeLabel("ＡＳＴ（ＳＧＯＴ）")).toBe("astsgot");
  });
});

describe("parseCheckupDate", () => {
  it("케이스2: '검진일: 2025년 11월 3일' 라벨 우선", () => {
    const t = "발행일 2026.01.15\n검진일: 2025년 11월 3일";
    expect(parseCheckupDate(t)).toBe("2025-11-03");
  });
  it("케이스3: 라벨 없으면 첫 날짜 (YYYY.MM.DD)", () => {
    expect(parseCheckupDate("결과통보서 2025.10.02 홍길동")).toBe("2025-10-02");
  });
  it("케이스4: 날짜 없으면 null", () => {
    expect(parseCheckupDate("이름 홍길동 판정 정상A")).toBeNull();
  });
});

describe("parseCheckupText — NHIS 서식 변형", () => {
  it("케이스5: 표 평탄화 한 줄 서식", () => {
    const t = [
      "공복혈당 95 mg/dL 정상A",
      "총콜레스테롤 188 mg/dL",
      "중성지방 140 mg/dL",
    ].join("\n");
    const { items } = parseCheckupText(t);
    const byLabel = Object.fromEntries(items.map((i) => [i.label, i.value]));
    expect(byLabel).toEqual({
      fasting_glucose: 95,
      total_cholesterol: 188,
      triglyceride: 140,
    });
  });

  it("케이스6: 혈압 120/80 → 수축기·이완기 분리", () => {
    const { items } = parseCheckupText("혈압(수축기/이완기) 128 / 84 mmHg");
    const byLabel = Object.fromEntries(items.map((i) => [i.label, i.value]));
    expect(byLabel.blood_pressure_systolic).toBe(128);
    expect(byLabel.blood_pressure_diastolic).toBe(84);
  });

  it("케이스7: 신장(키)과 신사구체여과율의 '신장' 구분", () => {
    const t = ["신장 172.5 cm", "신사구체여과율(신장기능) 92 mL/min"].join("\n");
    const { items } = parseCheckupText(t);
    const byLabel = Object.fromEntries(items.map((i) => [i.label, i.value]));
    expect(byLabel.height).toBe(172.5);
    expect(byLabel.egfr).toBe(92);
  });

  it("케이스8: 같은 항목 중복 등장 시 첫 값만", () => {
    const t = "공복혈당 95 mg/dL\n공복혈당 210 mg/dL(재검)";
    const { items } = parseCheckupText(t);
    expect(items.filter((i) => i.label === "fasting_glucose")).toHaveLength(1);
    expect(items[0].value).toBe(95);
  });

  it("케이스9: 타당 범위 밖 숫자는 버린다 (연도 오집기 방지)", () => {
    const t = "혈색소 2025 g/dL"; // 연도가 값 자리에 끼어든 케이스
    const { items } = parseCheckupText(t);
    expect(items).toHaveLength(0);
  });

  it("케이스10: AST(SGOT)/ALT(SGPT)/감마지티피 별칭", () => {
    const t = ["AST(SGOT) 24 U/L", "ALT(SGPT) 19 U/L", "감마지티피(γ-GTP) 31 U/L"].join(
      "\n",
    );
    const { items } = parseCheckupText(t);
    const byLabel = Object.fromEntries(items.map((i) => [i.label, i.value]));
    expect(byLabel).toEqual({ ast: 24, alt: 19, gamma_gtp: 31 });
  });

  it("케이스11: 소수점·단위 밀착 서식", () => {
    const t = "혈청크레아티닌0.9mg/dL\n체질량지수 23.4kg/m2";
    const { items } = parseCheckupText(t);
    const byLabel = Object.fromEntries(items.map((i) => [i.label, i.value]));
    expect(byLabel.creatinine).toBe(0.9);
    expect(byLabel.bmi).toBe(23.4);
  });
});

describe("matchToRules", () => {
  it("케이스12: 키 정확 일치 + display_name 별칭 매칭, 미매칭 분리", () => {
    const parsed = parseCheckupText(
      [
        "검진일 2025-11-03",
        "공복혈당 95 mg/dL",
        "혈압 128/84 mmHg",
        "페리틴 80 ng/mL",
        "체질량지수 23.4", // RULES 에 없음 → unmatched
      ].join("\n"),
    );
    const { matched, unmatchedLabels } = matchToRules(parsed, RULES);
    expect(matched.fasting_glucose).toBe("95");
    expect(matched.blood_pressure_systolic).toBe("128");
    expect(matched.blood_pressure_diastolic).toBe("84");
    expect(matched.ferritin).toBe("80");
    expect(unmatchedLabels).toContain("bmi");
    expect(parsed.date).toBe("2025-11-03");
  });

  it("케이스13: display_name_ko 가 별칭과 부분 일치해도 매칭", () => {
    const rules = [rule("tg", "중성지방(TG)")];
    const parsed = parseCheckupText("트리글리세라이드 150 mg/dL");
    const { matched } = matchToRules(parsed, rules);
    expect(matched.tg).toBe("150");
  });
});
