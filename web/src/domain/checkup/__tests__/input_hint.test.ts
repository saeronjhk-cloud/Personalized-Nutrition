/** 검진 입력 라벨 L01~L06 · 정본 IP/integration/checkup_input_label_eval_v1.md */
import { describe, it, expect } from "vitest";
import { INVERTED_BADGE, inputHint } from "../input_hint";
import { BANNED_WORDS } from "../compliance";

describe("검진 입력 라벨·안내", () => {
  it("L01 배지", () => expect(INVERTED_BADGE).toBe("(낮으면 주의)"));
  it("L02 HDL", () => expect(inputHint("HDL")).toBe("높을수록 좋은 콜레스테롤이에요."));
  it("L03 eGFR", () => { const h = inputHint("egfr")!; expect(h).toContain("비워"); expect(h).toContain("크레아티닌"); });
  it("L04 혈색소", () => { const h = inputHint("hemoglobin")!; expect(h).toContain("결과지"); expect(h).not.toContain("빈혈"); });
  it("L05 나머지 null", () => { for (const k of ["TSH", "creatinine", "LDL"]) expect(inputHint(k)).toBeNull(); });
  it("L06 개발 메모·금지어 0", () => {
    for (const k of ["HDL", "egfr", "hemoglobin"]) {
      const h = inputHint(k)!;
      expect(h).not.toMatch(/추천|역방향|low|비활성/);
      for (const w of BANNED_WORDS) expect(h).not.toContain(w);
    }
  });
});
