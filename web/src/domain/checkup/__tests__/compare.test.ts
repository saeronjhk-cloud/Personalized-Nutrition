/** 건강검진 비교 K01~K12 · W1 · 정본 IP/integration/health_report_checkup_compare_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareCheckups, trendKeys, CHANGE_LABEL_KO } from "../compare";
import type { Range } from "../engine";
import type { HistoryPoint } from "../timeseries";

let rid = 0;
const R = (key: string, min: number, max: number, level: string, extra: Partial<Range> = {}): Range => ({
  id: `r${rid++}`, biomarker_key: key, range_min: min, range_max: max, level, label_ko: level === "normal" ? "정상" : "주의",
  functional_needs: [], tone: null, force_medical_referral: false, sex_specific: null, sort_order: 0, ...extra,
});
const RANGES: Range[] = [
  R("LDL", 0, 130, "normal"), R("LDL", 130, 1000, "high"),
  R("ALT", 0, 40, "normal"), R("ALT", 40, 1000, "high"),
  R("fasting_glucose", 0, 100, "normal"), R("fasting_glucose", 100, 126, "watch"), R("fasting_glucose", 126, 200, "high"),
  R("fasting_glucose", 200, 1000, "high", { force_medical_referral: true }),
];
const RULES = [
  { biomarker_key: "LDL", display_name_ko: "LDL 콜레스테롤", unit: "mg/dL" },
  { biomarker_key: "ALT", display_name_ko: "ALT(간수치)", unit: "U/L" },
  { biomarker_key: "fasting_glucose", display_name_ko: "공복혈당", unit: "mg/dL" },
];
const H = (pts: [string, Record<string, number>][]): HistoryPoint[] => pts.map(([d, b]) => ({ recorded_date: d, biomarkers: b }));
const H2 = H([["2025-10-01", { LDL: 160, ALT: 20, fasting_glucose: 90, GGT: 30 }], ["2026-09-01", { LDL: 120, ALT: 25, fasting_glucose: 130, HDL: 50 }]]);

describe("K 건강검진 비교", () => {
  const c = compareCheckups(H2, 0, 1, RANGES, RULES)!;
  const row = (k: string) => c.rows.find((r) => r.key === k)!;
  it("K01 좋아짐", () => expect(row("LDL")).toMatchObject({ classification: "improving", delta: -40, changeRate: -25, prev: 160, curr: 120 }));
  it("K02 유지", () => expect(row("ALT").classification).toBe("stable"));
  it("K03 나빠짐 최상단", () => {
    expect(row("fasting_glucose").classification).toBe("worsening");
    expect(c.rows[0].key).toBe("fasting_glucose");
  });
  it("K04 의료진 상담 권장 최상단", () => {
    const h = H([["2025-01-01", { LDL: 160, fasting_glucose: 90 }], ["2026-01-01", { LDL: 200, fasting_glucose: 250 }]]);
    const r = compareCheckups(h, 0, 1, RANGES, RULES)!;
    expect(r.rows[0]).toMatchObject({ key: "fasting_glucose", classification: "needs_consult" });
  });
  it("K05 한쪽만 있는 수치 제외", () => {
    expect(c.rows.map((r) => r.key).sort()).toEqual(["ALT", "LDL", "fasting_glucose"]);
    expect(c.onlyOneSide).toBe(2);
  });
  it("K06 표시명·단위·폴백", () => {
    expect(row("LDL")).toMatchObject({ name: "LDL 콜레스테롤", unit: "mg/dL" });
    const r = compareCheckups(H([["a", { XYZ: 1 }], ["b", { XYZ: 2 }]]), 0, 1, [], [])!;
    expect(r.rows[0]).toMatchObject({ name: "XYZ", unit: "" });
  });
  it("K07 1건·0건 → null", () => {
    expect(compareCheckups(H([["a", { LDL: 1 }]]), 0, 0, RANGES, RULES)).toBeNull();
    expect(compareCheckups([], 0, 0, RANGES, RULES)).toBeNull();
  });
  it("K08 범위 밖 인덱스 고정", () => {
    const h3 = H([["a", { LDL: 160 }], ["b", { LDL: 140 }], ["c", { LDL: 120 }]]);
    expect(compareCheckups(h3, 0, 5, RANGES, RULES)!.afterDate).toBe("c");
  });
  it("K09 같은 기록 → null", () => expect(compareCheckups(H2, 1, 1, RANGES, RULES)).toBeNull());
  it("K10 trendKeys", () => {
    expect(trendKeys(c.rows, 5)).toEqual(["fasting_glucose", "LDL", "ALT"]);
    expect(trendKeys(c.rows, 2)).toEqual(["fasting_glucose", "LDL"]);
  });
  it("K11 ranges 없음 → 값만", () => {
    const r = compareCheckups(H2, 0, 1, [], RULES)!;
    expect(r.rows.find((x) => x.key === "LDL")).toMatchObject({ delta: -40, classification: "stable", currLabel: null });
  });
  it("K12 라벨 한국어", () => {
    expect(Object.keys(CHANGE_LABEL_KO).sort()).toEqual(["improving", "needs_consult", "stable", "watching", "worsening"]);
    for (const v of Object.values(CHANGE_LABEL_KO)) expect(v).not.toMatch(/위험|진단/);
  });
  it("W1 배선", () => {
    const hr = readFileSync(resolve(__dirname, "../../../pages/HealthReport.tsx"), "utf-8");
    const sec = readFileSync(resolve(__dirname, "../../../components/checkup/CheckupCompareSection.tsx"), "utf-8");
    expect(hr.match(/<CheckupCompareSection/g)?.length).toBe(2);
    expect(sec).toContain("CHECKUP_ENABLED");
    expect(sec).toContain("compareCheckups(");
  });
});
