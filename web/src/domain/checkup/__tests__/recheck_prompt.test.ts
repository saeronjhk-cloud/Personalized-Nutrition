/** 재검진 입력 안내 v1 — 평가셋 IP/integration/recheck_prompt_v1/00_설계·평가셋_v1.md R01~R10 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { recheckPrompt, RECHECK_SAVE_MESSAGE, RECHECK_PROMPT_DAYS } from "../recheck_prompt";
import { BANNED_WORDS } from "../compliance";

const NOW = new Date(2026, 9, 17, 9, 0, 0);
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

describe("R 재검진 입력 안내", () => {
  it("R01 기록 없음", () => expect(recheckPrompt(null, NOW, true)).toBeNull());
  it("R02 364일 전 → 없음", () => expect(recheckPrompt("2025-10-18", NOW, true)).toBeNull());
  it("R03 365일 전 → 안내 · 연월", () => {
    const r = recheckPrompt("2025-10-17", NOW, true);
    expect(r?.daysSince).toBe(RECHECK_PROMPT_DAYS);
    expect(r?.text).toBe("마지막 검진 기록이 2025년 10월이에요. 새 검진 결과가 있으면 입력해 보세요.");
  });
  it("R04 3년 전", () => expect(recheckPrompt("2023-08-06", NOW, true)?.text).toContain("2023년 8월"));
  it("R05 검진 기능 꺼짐", () => expect(recheckPrompt("2023-08-06", NOW, false)).toBeNull());
  it("R06 날짜 형식 이상", () => {
    expect(recheckPrompt("abc", NOW, true)).toBeNull();
    expect(recheckPrompt("2023-02-30", NOW, true)).toBeNull();
  });
  it("R07 미래 날짜", () => expect(recheckPrompt("2027-01-01", NOW, true)).toBeNull());
  it("R08 검진을 받으라는 말·금지어 없음 · 권유형", () => {
    const t = recheckPrompt("2024-01-01", NOW, true)!.text;
    for (const w of [...BANNED_WORDS, "받으세요", "받아 보세요", "재검"]) expect(t).not.toContain(w);
    expect(t.endsWith("보세요.")).toBe(true);
  });
  it("R09 저장 성공 문구 — «3개월» 없음", () => {
    const form = read("../../../components/checkup/BiomarkerForm.tsx");
    expect(form).not.toContain("3개월 후 재검진");
    expect(form).toContain("setSaveMessage(RECHECK_SAVE_MESSAGE)");
    expect(RECHECK_SAVE_MESSAGE).not.toMatch(/개월|재검/);
  });
  it("R10 화면·데이터 연결", () => {
    const home = read("../../../components/home/ReturningHome.tsx");
    expect(home).toContain("recheckPrompt(latestCheckupDate, now, CHECKUP_ENABLED)");
    expect(home).toContain('data-testid="recheck-prompt"');
    expect(home).not.toContain("마지막 검진 기록이");
    const data = read("../../../lib/homeData.ts");
    expect(data).toMatch(/from\('checkup_records'\)\.select\('recorded_date'\)[\s\S]{0,120}\.is\('deleted_at', null\)[\s\S]{0,80}order\('recorded_date', \{ ascending: false \}\)[\s\S]{0,20}\.limit\(1\)/);
  });
});
