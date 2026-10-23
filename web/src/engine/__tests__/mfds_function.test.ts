/** 결과 화면 «식약처 인정: …» 문구 = 고시·개별인정 원문 (2026-10-23 대조)
 *  정본 IP/evals/eval_mfds_function_v1.json (복사본 fixtures/) · 상세 IP/integration/mfds_function_v1/00_식약처기능성문구_대조_20261023.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SUPPLEMENTS } from "../data";

interface Gold { id: string; mfds_type: string; mfds_function: string; status: string }
const EV = JSON.parse(readFileSync(resolve(__dirname, "fixtures/eval_mfds_function_v1.json"), "utf-8")) as { cases: Gold[] };

describe("식약처 기능성 문구 v1", () => {
  it("엔진 30종 = 평가셋 30건(빠짐·남음 없음)", () => {
    expect(SUPPLEMENTS.map((s) => s.id).sort()).toEqual(EV.cases.map((c) => c.id).sort());
  });
  for (const c of EV.cases) {
    it(`${c.id} (${c.status})`, () => {
      const s = SUPPLEMENTS.find((x) => x.id === c.id)!;
      expect(s.evidence?.mfds_function ?? "").toBe(c.mfds_function);
      expect(s.evidence?.mfds_type ?? "").toBe(c.mfds_type);
      if (c.status !== "확인") expect(s.evidence?.mfds_function ?? "").toBe("");
    });
  }
  it("고시에 없는 옛 표현이 다시 들어오지 않음", () => {
    const all = SUPPLEMENTS.map((s) => s.evidence?.mfds_function ?? "").join("\n");
    for (const w of ["피로 회복에 도움", "면역기능 유지에 필요", "간 기능 개선", "황반변성 위험 감소", "제2013-22호", "제2018-4호", "음주로 인한 피로"]) expect(all).not.toContain(w);
    const types = SUPPLEMENTS.map((s) => s.evidence?.mfds_type ?? "").join("\n");
    for (const w of ["제2013-22호", "제2018-4호"]) expect(types).not.toContain(w);
  });
});
