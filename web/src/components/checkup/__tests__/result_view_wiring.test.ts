/** 검진 결과 화면 W1 · 정본 IP/integration/checkup_result_view_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const list = read("../RecommendationList.tsx");

describe("결과 화면 배선", () => {
  it("W1 buildResultView 만 · CategoryCard 미사용 · 면책 1회 · 범위 내 접힘", () => {
    expect(list).toContain("buildResultView(results, rules)");
    expect(list).not.toMatch(/CategoryCard|functional_needs|force_medical_referral|level ===/);
    expect(list.match(/RESULT_DISCLAIMER/g)).toHaveLength(2); // import 1 + 렌더 1
    expect(list).toContain("<details");
    expect(list).not.toMatch(/관심/);
  });
});
