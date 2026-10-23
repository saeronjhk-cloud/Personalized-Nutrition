/** 추천 제외 원료(H149) — 평가셋 IP/evals/eval_not_recommended_v1.json (복사본 fixtures/) */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runRecommendation } from "../recommender";
import { SUPPLEMENTS, SYMPTOM_SCORE_MAP } from "../data";
import { NOT_RECOMMENDED, isRecommendable } from "../exclusions";
import { GOAL_OPTIONS } from "../../domain/goals/goals";
import type { SurveyAnswers } from "../../types";

interface Case { id: string; label: string; answers: SurveyAnswers; before: string[]; expected: string[] }
const EV = JSON.parse(readFileSync(resolve(__dirname, "fixtures/eval_not_recommended_v1.json"), "utf-8")) as { excluded: Record<string, string>; cases: Case[] };

describe("추천 제외 원료 v1", () => {
  it("제외 목록 = 평가셋(레몬밤·레드클로버) · 데이터는 남김(R3)", () => {
    expect(Object.keys(NOT_RECOMMENDED).sort()).toEqual(Object.keys(EV.excluded).sort());
    for (const id of Object.keys(EV.excluded)) {
      expect(SUPPLEMENTS.some((s) => s.id === id)).toBe(true);
      expect(isRecommendable(id)).toBe(false);
    }
    expect(isRecommendable("gaba")).toBe(true);
  });
  for (const c of EV.cases) {
    it(`${c.id} ${c.label}`, () => {
      expect(runRecommendation(c.answers).recommendations.map((r) => r.id)).toEqual(c.expected);
    });
  }
  it("R2 제외와 무관한 설문은 결과 그대로", () => {
    for (const c of EV.cases.filter((x) => !x.before.some((id) => id in EV.excluded))) expect(c.expected).toEqual(c.before);
  });
  it("R1 무작위 설문 1,000건 어디에도 제외 원료 없음", () => {
    const SYM = Object.keys(SYMPTOM_SCORE_MAP), GO = GOAL_OPTIONS.map((g) => g.id), ALC = ["거의_안함", "주1-2회", "주3-4회", "매일"];
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = (a: string[], n: number) => { const c = [...a], o: string[] = []; for (let i = 0; i < n && c.length; i++) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };
    for (let i = 0; i < 1000; i++) {
      const a = { 성별: rnd() < 0.5 ? "female" : "male", 나이: 20 + Math.floor(rnd() * 56), 신장: 165, 체중: 55 + Math.floor(rnd() * 30), 체중변화: "변화없음",
        증상: pick(SYM, Math.floor(rnd() * 6)), 목표: pick(GO, 1 + Math.floor(rnd() * 3)), 음주: ALC[Math.floor(rnd() * 4)], 현재복용영양제: [], 기저질환: [], 가족력: [] } as SurveyAnswers;
      const ids = runRecommendation(a).recommendations.map((r) => r.id);
      for (const ex of Object.keys(NOT_RECOMMENDED)) expect(ids).not.toContain(ex);
    }
  });
});
