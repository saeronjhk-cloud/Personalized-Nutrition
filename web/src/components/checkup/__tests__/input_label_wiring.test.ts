/** 검진 입력 라벨 W1 · 정본 IP/integration/checkup_input_label_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

describe("검진 입력 라벨 배선", () => {
  for (const f of ["../BiomarkerForm.tsx", "../EditCheckup.tsx"]) {
    it(`W1 ${f}`, () => {
      const s = read(f);
      expect(s).not.toContain("낮을수록 양호");
      expect(s).not.toMatch(/rule\.note/);
      expect(s).toContain("INVERTED_BADGE");
      expect(s).toContain("inputHint(");
    });
  }
});
