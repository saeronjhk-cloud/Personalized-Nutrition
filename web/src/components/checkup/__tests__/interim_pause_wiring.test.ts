/** 검진 임시 조치 v1 P06·P07·W1~W4 · 정본 IP/integration/checkup_interim_pause_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

describe("임시 조치 배선", () => {
  it("P06 통합 로더 결합 중단", () => {
    const s = read("../../../lib/loadUnifiedInputs.ts");
    expect(s).toMatch(/if \(!plan\.checkup \|\| CHECKUP_COMBINE_PAUSED\) return null;/);
  });
  it("P07 식사 코칭 결합 중단", () => {
    expect(read("../../../lib/goalCoaching.ts")).toMatch(/if \(!CHECKUP_ENABLED \|\| CHECKUP_COMBINE_PAUSED\) return null/);
  });
  it("W1 BiomarkerForm 저장 버튼 대신 안내", () => {
    const s = read("../BiomarkerForm.tsx");
    const i = s.indexOf("{CHECKUP_SAVE_PAUSED ? (");
    expect(i).toBeGreaterThan(0);
    expect(s.indexOf('data-testid="checkup-save-paused"')).toBeGreaterThan(i);
    expect(s.indexOf('onClick={() => handleSave()}')).toBeGreaterThan(s.indexOf('data-testid="checkup-save-paused"'));
  });
  it("W2 EditCheckup 수정 저장 비활성", () => {
    const s = read("../EditCheckup.tsx");
    expect(s).toContain("disabled={saving || CHECKUP_SAVE_PAUSED}");
    expect(s).toContain('data-testid="checkup-edit-paused"');
  });
  it("W3 Checkup 상단 추천 문구 숨김", () => {
    const s = read("../../../pages/Checkup.tsx");
    expect(s.indexOf("{!CHECKUP_COMBINE_PAUSED && (")).toBeGreaterThan(0);
    expect(s.indexOf("{!CHECKUP_COMBINE_PAUSED && (")).toBeLessThan(s.indexOf("더 정밀한 영양제 추천"));
  });
  it("W4 SQL 160", () => {
    const s = read("../../../../supabase/160_checkup_save_pause.sql");
    const body = s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(body).toContain("revoke insert on table public.checkup_records  from authenticated, anon;");
    expect(body).toContain("revoke insert on table public.biomarker_values from authenticated, anon;");
    expect(body).not.toMatch(/revoke (select|update|delete)/i);
    expect(body).not.toMatch(/^\s*grant /im);
    expect(s).toContain("-- grant insert on table public.checkup_records  to authenticated;");
  });
});
