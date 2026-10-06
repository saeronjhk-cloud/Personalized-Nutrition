/** 요단백 배선 W1·W2·W3 · 정본 IP/integration/checkup_urine_protein_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

describe("요단백 배선", () => {
  it("W1 입력칸은 BiomarkerValueInput(요단백 select)", () => {
    for (const f of ["../BiomarkerForm.tsx", "../EditCheckup.tsx"]) {
      const s = read(f);
      expect(s).toContain("<BiomarkerValueInput");
      expect(s).not.toMatch(/<input\s+id=\{`(edit-)?biomarker-/);
    }
    const inp = read("../BiomarkerValueInput.tsx");
    expect(inp).toContain("URINE_PROTEIN_OPTIONS");
    expect(inp).toContain("<select");
  });
  it("W2 값 표시는 formatBiomarkerValue", () => {
    expect(read("../RecommendationList.tsx")).toContain("formatBiomarkerValue(it.key, it.value)");
    const c = read("../CheckupCompareSection.tsx");
    expect(c).toContain("formatBiomarkerValue(r.key, r.curr)");
    expect(c).toContain("!isOrdinalKey(r.key)");
  });
  it("W3 SQL 159 요단백만", () => {
    const sql = read("../../../../supabase/159_biomarker_urine_protein_v1_3.sql");
    expect(sql).toContain("delete from public.biomarker_ranges where biomarker_key = 'urine_protein';");
    expect(sql.match(/\('urine_protein', [\d.]+, [\d.]+,/g)).toHaveLength(3);
    expect(sql).not.toMatch(/alter table|drop /i);
  });
});
