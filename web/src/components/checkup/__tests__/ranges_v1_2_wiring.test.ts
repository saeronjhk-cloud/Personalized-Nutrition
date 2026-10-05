/** 판정표 v1.2 배선 W1·W2 · 정본 IP/integration/checkup_ranges_v1_2_eval.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const form = read("../BiomarkerForm.tsx");
const view = read("../ViewCheckup.tsx");
const unified = read("../../../lib/loadUnifiedInputs.ts");
const card = read("../CategoryCard.tsx");

describe("판정표 v1.2 배선", () => {
  it("W1 runEngine 전에 withEgfrInput · 저장은 원본 입력", () => {
    for (const src of [form, view, unified]) {
      expect(src.indexOf("withEgfrInput(")).toBeGreaterThan(0);
      expect(src.indexOf("withEgfrInput(")).toBeLessThan(src.lastIndexOf("runEngine(eg.input"));
    }
    const save = form.slice(form.indexOf("async function handleSave"), form.indexOf("async function handleShowTimeseries"));
    expect(save).toContain("biomarker_input: buildBiomarkerInput()");
    expect(save).not.toContain("withEgfrInput");
    expect(form).toContain('data-testid="egfr-derived-note"');
    expect(view).toContain('data-testid="egfr-derived-note"');
  });
  it("W2 결과 카드 한글 이름", () => {
    expect(card).toContain("names?.[result.biomarker_key] ?? result.biomarker_key");
    expect(form).toContain("names={Object.fromEntries(rules.map(");
    expect(view).toContain("names={names}");
  });
});
