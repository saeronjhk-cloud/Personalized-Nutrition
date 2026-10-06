/** 결과 화면 다듬기 v2 B01·C01·W1 · 정본 IP/integration/checkup_result_view_eval_v2.md */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/__tests__/.test(p)) out.push(p);
  }
  return out;
}

describe("결과 화면 v2 배선", () => {
  it("B01 ViewCheckup 상담 배너 중복 제거", () => {
    const view = read("../ViewCheckup.tsx");
    expect(view).not.toContain("전문가 상담이 권장되는 항목이");
    expect(view).not.toContain("referralCount");
    expect(view).toContain("<RecommendationList results={results} rules={rules} />");
  });
  it("C01 CategoryCard 삭제 · import 0", () => {
    expect(existsSync(resolve(__dirname, "../CategoryCard.tsx"))).toBe(false);
    for (const f of walk(resolve(__dirname, "../../.."))) expect(readFileSync(f, "utf-8")).not.toMatch(/CategoryCard/);
  });
  it("W1 톤 판단은 result_view 한 곳", () => {
    const list = read("../RecommendationList.tsx");
    expect(list).not.toMatch(/functional_needs|생활관리권장|관리권장/);
  });
});
