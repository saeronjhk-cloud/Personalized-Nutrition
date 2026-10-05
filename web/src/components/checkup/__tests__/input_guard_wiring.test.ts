/** 검진 입력 가드 배선 W1~W3 · 정본 IP/integration/checkup_input_guard_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const form = readFileSync(resolve(__dirname, "../BiomarkerForm.tsx"), "utf-8");
const edit = readFileSync(resolve(__dirname, "../EditCheckup.tsx"), "utf-8");

describe("검진 입력 가드 배선", () => {
  it("W1 BiomarkerForm: 분석·저장 전 가능 범위 · 저장 전 같은 날짜 · 그래도 새로 저장", () => {
    const analyze = form.slice(form.indexOf("async function handleAnalyze"), form.indexOf("async function handleSave"));
    expect(analyze.indexOf("checkPlausible()")).toBeLessThan(analyze.indexOf("fetchRanges("));
    const save = form.slice(form.indexOf("async function handleSave"), form.indexOf("async function handleShowTimeseries"));
    expect(save.indexOf("checkPlausible()")).toBeLessThan(save.indexOf("saveCheckup("));
    expect(save.indexOf("sameDateRecord(records, recordedDate)")).toBeLessThan(save.indexOf("saveCheckup("));
    expect(form).toContain("onClick={() => handleSave(true)}");
    expect(form).toContain('data-testid="checkup-input-warnings"');
    expect(form).toContain('data-testid="checkup-dup-date"');
    expect(form).toContain("implausibleMessage(");
  });
  it("W2 EditCheckup: 저장 전 가능 범위", () => {
    expect(edit.indexOf("implausibleValues(biomarker_input)")).toBeLessThan(edit.indexOf("await updateCheckup("));
    expect(edit.indexOf("implausibleValues(biomarker_input)")).toBeGreaterThan(0);
  });
  it("W3 검진일 기본값은 로컬 날짜(toISOString 금지)", () => {
    const f = form.slice(form.indexOf("function todayISO"), form.indexOf("export default function"));
    expect(f).not.toContain("toISOString");
    expect(f).toContain("getFullYear()");
  });
});
