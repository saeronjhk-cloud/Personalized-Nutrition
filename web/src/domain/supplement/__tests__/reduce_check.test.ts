/** 지금 드시는 영양제 점검 v1.2 — 평가셋 IP/evals/eval_supplement_check_v1.2.json(복사본 fixtures/) E01~E20 + 문구·화면 검사 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reduceCheck, reduceCandidates, ironSymptomIds, REDUCE_TEXT, onMedication } from "../reduce_check";
import { BANNED_WORDS } from "../../checkup/compliance";
import { SUPPLEMENT_CHECK_ENABLED } from "../../../lib/flags";
import type { SurveyAnswers } from "../../../types";

interface EvalCase { id: string; note: string; input: Partial<SurveyAnswers>; candidates: string[]; shown: string[]; text?: Record<string, string> }
const EV = JSON.parse(readFileSync(resolve(__dirname, "fixtures/eval_supplement_check_v1.2.json"), "utf-8")) as { base: SurveyAnswers; cases: EvalCase[] };
const A = (o: Partial<SurveyAnswers>): SurveyAnswers => ({ ...EV.base, ...o }) as SurveyAnswers;

describe("영양제 점검 v1.2 평가셋", () => {
  it("케이스 20건", () => expect(EV.cases.length).toBe(20));
  for (const c of EV.cases) {
    it(`${c.id} ${c.note}`, () => {
      const a = A(c.input);
      const cand = reduceCandidates(a);
      expect(cand.map((l) => l.id)).toEqual(c.candidates);
      expect(reduceCheck(a).map((l) => l.id)).toEqual(c.shown);
      for (const [id, t] of Object.entries(c.text ?? {})) expect(cand.find((l) => l.id === id)?.text).toBe(t);
    });
  }
});

describe("영양제 점검 v1.2 규칙·화면", () => {
  it("결과 화면 3경로 모두 설문 답을 넘긴다(answers={null} 금지 — 10-18 점검 상자 미표시 원인)", () => {
    for (const f of ["../../../pages/Recommend.tsx", "../../../components/survey/SurveyResultView.tsx", "../../../App.tsx"]) {
      const src = readFileSync(resolve(__dirname, f), "utf-8");
      expect(src).toMatch(/<Results[\s\S]*?answers=/);
      expect(src).not.toMatch(/<Results[^>]*answers=\{null\}/);
    }
  });
  it("철분 연결 증상 단일 출처(data.ts)", () => expect(ironSymptomIds()).toContain("chronic_fatigue"));
  it("약 복용 «없음»이면 약 이름이 남아 있어도 MEDS 아님", () =>
    expect(onMedication(A({ 복용약있음: "없음", 복용약물: "혈압약" }))).toBe(false));
  it("복용 없음 → 빈 목록", () => expect(reduceCheck(A({}))).toEqual([]));
  it("문구 금지어·끊으라는 말 0 · «2시간» 없음 · 끝 «요.»", () => {
    for (const t of Object.values(REDUCE_TEXT)) {
      for (const w of [...BANNED_WORDS, "끊", "중단", "2시간"]) expect(t).not.toContain(w);
      expect(t.endsWith("요.")).toBe(true);
    }
  });
  it("화면 연결 · 기본 OFF · 설문 문항 2개", () => {
    expect(SUPPLEMENT_CHECK_ENABLED).toBe(false);
    const res = readFileSync(resolve(__dirname, "../../../pages/Results.tsx"), "utf-8");
    expect(res).toContain("if (!SUPPLEMENT_CHECK_ENABLED) return null");
    expect(res).toContain("reduceCheck(answers)");
    expect(res).toContain('data-testid="supplement-check"');
    expect(res).not.toContain("철분은 필요한 경우가");
    const q = readFileSync(resolve(__dirname, "../../../pages/Questions.tsx"), "utf-8");
    expect(q).toContain("지금 드시는 약(처방약·일반의약품)이 있나요?");
    expect(q).toContain("철분은 진단이나 의사·약사 권고로 드시나요?");
    expect(q).toContain("SUPPLEMENT_CHECK_ENABLED && answers.현재복용영양제.includes('iron')");
    expect(q).toContain("(!SUPPLEMENT_CHECK_ENABLED || answers.복용약있음 === '있음')");
  });
});
