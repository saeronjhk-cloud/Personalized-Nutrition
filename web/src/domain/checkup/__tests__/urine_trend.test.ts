/** 요단백 비교·추이 T01 · 정본 IP/integration/checkup_urine_protein_eval_v1.md */
import { describe, it, expect } from "vitest";
import { compareCheckups, trendKeys } from "../compare";
import { getTopChanges } from "../timeseries";
import type { Range } from "../engine";

const rng = (key: string, mn: number, mx: number, level: string, label: string): Range => ({
  id: key + mn, biomarker_key: key, range_min: mn, range_max: mx, level, label_ko: label, functional_needs: [], tone: null, force_medical_referral: level === "high", sex_specific: null, sort_order: 0,
});
const ranges = [
  rng("urine_protein", 0, 0.5, "normal", "참고범위 내"), rng("urine_protein", 0.5, 1, "watch", "참고범위보다 높음"), rng("urine_protein", 1, 99, "high", "의료진 상담 권장"),
  rng("LDL", 0, 130, "normal", "참고범위 내"), rng("LDL", 130, 160, "watch", "참고범위보다 높음"), rng("LDL", 160, 999, "high", "의료진 상담 권장"),
];
const history = [
  { recorded_date: "2025-05-01", biomarkers: { urine_protein: 0, LDL: 120 } },
  { recorded_date: "2026-05-01", biomarkers: { urine_protein: 1, LDL: 125 } },
];

describe("요단백 비교·추이", () => {
  it("T01 비교 행은 남기고 · 추이 그래프·변화 상위에서는 제외", () => {
    const cmp = compareCheckups(history, 0, 1, ranges, [{ biomarker_key: "urine_protein", display_name_ko: "요단백", unit: "" } as never])!;
    expect(cmp.rows.map((r) => r.key)).toContain("urine_protein");
    expect(trendKeys(cmp.rows)).not.toContain("urine_protein");
    expect(getTopChanges(history, ranges).map((c) => c.biomarker_key)).toEqual(["LDL"]);
  });
});
