/** H150 인정 기능성 카테고리만 추천 — 대응표 정본 IP/evals/eval_claim_categories_v1.json(복사본 ../claim_categories_v1.json)
 *  사례 평가셋 IP/evals/eval_reco_claims_v1.json(복사본 fixtures/) */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runRecommendation } from "../recommender";
import { SUPPLEMENTS, SYMPTOM_SCORE_MAP } from "../data";
import { CLAIMS, allowedCategories } from "../claims";
import { GOAL_OPTIONS } from "../../domain/goals/goals";
import { FUNCTIONAL_NEED_TO_CATEGORY } from "../../domain/unified/adapter";
import type { SurveyAnswers } from "../../types";

interface Case { id: string; label: string; answers: SurveyAnswers; expected: string[] }
const EV = JSON.parse(readFileSync(resolve(__dirname, "fixtures/eval_reco_claims_v1.json"), "utf-8")) as { cases: Case[] };
const EMPTY = ["vitamin_c", "vitamin_b", "vitamin_e", "selenium", "chromium", "lemon_balm", "red_clover", "iron", "folic_acid"];

describe("H150 인정 기능성 대응표", () => {
  it("엔진 30종 모두 대응표에 있음 · 근거 문장 있음", () => {
    for (const s of SUPPLEMENTS) { expect(CLAIMS[s.id], s.id).toBeTruthy(); expect(CLAIMS[s.id].basis.length).toBeGreaterThan(3); }
  });
  it("대응 카테고리 없는 원료", () => { for (const id of EMPTY) expect(Object.keys(CLAIMS[id].cats)).toEqual([]); });
  it("쏘팔메토 = 남성 전용(P3) · 홍삼 갱년기 = 여성만 · GABA = 수면만(P4)", () => {
    expect(allowedCategories("saw_palmetto", "female").size).toBe(0);
    expect(allowedCategories("red_ginseng", "male").has("갱년기")).toBe(false);
    expect(allowedCategories("red_ginseng", "female").has("갱년기")).toBe(true);
    expect([...allowedCategories("gaba", "female")]).toEqual(["수면"]);
  });
  it("검진 철분·비타민D 신호는 트랙 A 카테고리로 가지 않음(트랙 B 가 직접 읽음 · H154)", () => {
    expect(FUNCTIONAL_NEED_TO_CATEGORY["철분보충"]).toBeUndefined();
    expect(FUNCTIONAL_NEED_TO_CATEGORY["비타민D보충"]).toBeUndefined();
    expect(allowedCategories("iron", "female").size).toBe(0);
    expect(allowedCategories("folic_acid", "female").size).toBe(0);
  });
});

describe("H150 사례 평가셋", () => {
  for (const c of EV.cases) it(`${c.id} ${c.label}`, () => {
    expect(runRecommendation(c.answers).recommendations.map((r) => r.id)).toEqual(c.expected);
  });
});

describe("H150 무작위 설문 1,000건 성질", () => {
  it("허용 카테고리 밖 추천 없음 · 쏘팔메토 여성 0 · 빈 원료 0 · 엽산은 임산부만", () => {
    const SYM = Object.keys(SYMPTOM_SCORE_MAP), GO = GOAL_OPTIONS.map((g) => g.id), ALC = ["거의_안함", "주1-2회", "주3-4회", "매일"];
    let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = (a: string[], n: number) => { const c = [...a], o: string[] = []; for (let i = 0; i < n && c.length; i++) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };
    for (let i = 0; i < 1000; i++) {
      const preg = rnd() < 0.05;
      const a = { 성별: preg || rnd() < 0.5 ? "female" : "male", 나이: 20 + Math.floor(rnd() * 56), 신장: 165, 체중: 55 + Math.floor(rnd() * 30), 체중변화: "변화없음",
        증상: pick(SYM, Math.floor(rnd() * 6)), 목표: pick(GO, 1 + Math.floor(rnd() * 3)), 음주: ALC[Math.floor(rnd() * 4)], 현재복용영양제: [], 기저질환: preg ? ["임산부_수유부"] : [], 가족력: [] } as SurveyAnswers;
      const ids = runRecommendation(a).recommendations.map((r) => r.id);
      for (const id of ids) {
        const cond = CLAIMS[id].condition && a.기저질환.includes(CLAIMS[id].condition!.id);
        expect(allowedCategories(id, a.성별).size > 0 || cond, `${id} ${a.성별}`).toBe(true);
      }
      if (a.성별 === "female") expect(ids).not.toContain("saw_palmetto");
      for (const e of EMPTY) expect(ids).not.toContain(e);
    }
  });
});
