/** 검진 신속 확인 W1 · 정본 IP/integration/checkup_urgent_check_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const list = readFileSync(resolve(__dirname, "../RecommendationList.tsx"), "utf-8");

describe("신속 확인 배선", () => {
  it("W1 urgentChecks · alert · 요약 줄보다 위 · 기준 숫자 하드코딩 0", () => {
    expect(list).toContain("urgentChecks(results)");
    expect(list).toContain('data-testid="checkup-urgent"');
    expect(list).toContain('role="alert"');
    expect(list.indexOf("checkup-urgent")).toBeLessThan(list.indexOf("개 항목</strong>"));
    expect(list).not.toMatch(/\b(180|120|300)\b/);
  });
});
