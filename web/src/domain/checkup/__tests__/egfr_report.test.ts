/** 평가: IP/integration/health_report_egfr_eval_v1.md (G01~G14·W1) */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { withDerivedEgfr, egfrRanges, withEgfrSupport, EGFR_RULE } from "../egfr_report";
import { classifyChange, normalizeHistory, type CheckupHistoryRow } from "../timeseries";
import { compareCheckups, CHANGE_LABEL_KO } from "../compare";
import { DEFAULT_GOAL_COACHING_PARAMS } from "../../coaching/goal_coaching_params";

const M = { sex: "M", birth_year: 1974 };
const row = (d: string, b: Record<string, number>, units?: Record<string, string>): CheckupHistoryRow => ({ recorded_date: d, biomarkers: b, units });

describe("withDerivedEgfr", () => {
  it("G01 남 1974 · Scr 1.0/1.3", () => {
    const r = withDerivedEgfr([row("2024-05-01", { creatinine: 1.0 }), row("2026-05-01", { creatinine: 1.3 })], M);
    expect(r.rows.map((x) => x.biomarkers.egfr)).toEqual([91.7, 66.1]);
    expect(r.derivedCount).toBe(2);
    expect(r.sexAssumed).toBe(false);
  });
  it("G02 측정 egfr 우선", () => {
    const r = withDerivedEgfr([row("2026-05-01", { egfr: 75, creatinine: 3.0 })], M);
    expect(r.rows[0].biomarkers.egfr).toBe(75);
    expect(r.derivedCount).toBe(0);
  });
  it("G03 크레아티닌 없음", () => {
    expect(withDerivedEgfr([row("2026-05-01", { LDL: 120 })], M).rows[0].biomarkers.egfr).toBeUndefined();
  });
  it("G04 성별 미상 → 낮은 값", () => {
    const r = withDerivedEgfr([row("2026-05-01", { creatinine: 1.0 })], { sex: null, birth_year: 1974 });
    expect(r.rows[0].biomarkers.egfr).toBe(67.8);
    expect(r.sexAssumed).toBe(true);
  });
  it("G05 μmol/L 환산", () => {
    expect(withDerivedEgfr([row("2026-05-01", { creatinine: 106 }, { creatinine: "μmol/L" })], M).rows[0].biomarkers.egfr).toBe(72.8);
  });
  it("G06 출생연도 없음·17세·프로필 없음", () => {
    expect(withDerivedEgfr([row("2026-05-01", { creatinine: 1.0 })], { sex: "M", birth_year: null }).derivedCount).toBe(0);
    expect(withDerivedEgfr([row("2026-05-01", { creatinine: 1.0 })], { sex: "M", birth_year: 2009 }).derivedCount).toBe(0);
    expect(withDerivedEgfr([row("2026-05-01", { creatinine: 1.0 })], null).derivedCount).toBe(0);
  });
  it("G07 입력 불변", () => {
    const input = [row("2026-05-01", { creatinine: 1.0 })];
    const snap = JSON.stringify(input);
    withDerivedEgfr(input, M);
    expect(JSON.stringify(input)).toBe(snap);
  });
});

describe("egfrRanges", () => {
  const contiguous = (rs: ReturnType<typeof egfrRanges>) => {
    expect(rs[0].range_min).toBe(0);
    for (let i = 1; i < rs.length; i++) expect(rs[i].range_min).toBe(rs[i - 1].range_max);
    expect(rs[rs.length - 1].range_max).toBeGreaterThan(200);
  };
  it("G08 6구간 · 연속 · <30 만 상담 권장", () => {
    const rs = egfrRanges(60);
    expect(rs).toHaveLength(6);
    contiguous(rs);
    expect(rs.filter((r) => r.force_medical_referral).every((r) => r.range_max <= 30)).toBe(true);
    expect(rs.filter((r) => r.force_medical_referral)).toHaveLength(2);
  });
  it("G09 판정", () => {
    const rs = egfrRanges(60);
    expect(classifyChange("egfr", 95, 70, rs)).toBe("stable");
    expect(classifyChange("egfr", 64, 58, rs)).toBe("watching");
    expect(classifyChange("egfr", 35, 65, rs)).toBe("improving");
    expect(classifyChange("egfr", 50, 40, rs)).toBe("worsening");
    expect(classifyChange("egfr", 40, 25, rs)).toBe("needs_consult");
  });
  it("G10 block 고정", () => {
    const r45 = egfrRanges(45);
    expect(r45.some((r) => r.level === "watch")).toBe(false);
    contiguous(r45);
    expect(egfrRanges(30)).toEqual(r45);
    const r100 = egfrRanges(100);
    contiguous(r100);
    expect(r100.find((r) => r.level === "watch")!.range_max).toBe(90);
  });
  it("G14 기본 block = 코칭 EGFR_BLOCK", () => {
    expect(egfrRanges()).toEqual(egfrRanges(DEFAULT_GOAL_COACHING_PARAMS.EGFR_BLOCK));
  });
});

describe("withEgfrSupport · compare", () => {
  it("G11 DB 우선 · 중복 0", () => {
    const a = withEgfrSupport([], []);
    expect(a.ranges).toHaveLength(6);
    expect(a.rules).toEqual([EGFR_RULE]);
    const db = egfrRanges(60).slice(0, 1).map((r) => ({ ...r, id: "db" }));
    const b = withEgfrSupport(db, [{ biomarker_key: "egfr", display_name_ko: "DB", unit: "x" }]);
    expect(b.ranges).toEqual(db);
    expect(b.rules).toHaveLength(1);
  });
  it("G12 compareCheckups 행", () => {
    const d = withDerivedEgfr([row("2024-05-01", { creatinine: 1.0 }), row("2026-05-01", { creatinine: 1.3 })], M);
    const s = withEgfrSupport([], [{ biomarker_key: "creatinine", display_name_ko: "크레아티닌", unit: "mg/dL" }]);
    const cmp = compareCheckups(normalizeHistory(d.rows), 0, 1, s.ranges, s.rules)!;
    const e = cmp.rows.find((r) => r.key === "egfr")!;
    expect(e.name).toBe("eGFR(신장 여과율 추정)");
    expect(e.unit).toBe("mL/min/1.73m²");
    expect(e.currLabel).toBe("정상~약간 감소");
    expect(cmp.rows.some((r) => r.key === "creatinine")).toBe(true);
  });
  it("G13 금지어 없음", () => {
    const txt = [...egfrRanges().map((r) => r.label_ko), EGFR_RULE.display_name_ko, ...Object.values(CHANGE_LABEL_KO)].join(" ");
    expect(txt).not.toMatch(/위험|진단/);
  });
  it("W1 배선", () => {
    const loader = readFileSync(resolve(__dirname, "../../../lib/checkupCompare.ts"), "utf-8");
    expect(loader).toContain("withDerivedEgfr(");
    expect(loader).toContain("withEgfrSupport(");
    const sec = readFileSync(resolve(__dirname, "../../../components/checkup/CheckupCompareSection.tsx"), "utf-8");
    expect(sec).toContain("CKD-EPI 2021");
  });
});
