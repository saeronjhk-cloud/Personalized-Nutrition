/** 트랙 B v1 — 평가셋 IP/evals/eval_track_b_v1.json (복사본 fixtures/) · 명세 IP/integration/nutrient_track_b_v1 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { trackB, labsFromCheckup, PRODUCT_ORDER, CARD_TEXT, type TrackBLabs } from "../track_b";
import { runRecommendation, effectiveConditions } from "../../../engine/recommender";
import { BANNED_WORDS } from "../../checkup/compliance";
import type { SurveyAnswers } from "../../../types";

interface Case { id: string; label: string; answers: SurveyAnswers; labs?: TrackBLabs; expected: { products: string[]; cards: string[] } }
const EV = JSON.parse(readFileSync(resolve(__dirname, "fixtures/eval_track_b_v1.json"), "utf-8")) as { order: string[]; cases: Case[] };

describe("트랙 B 평가셋 v1", () => {
  it("23건 · 제품 순서 = 명세", () => {
    expect(EV.cases.length).toBe(23);
    expect([...PRODUCT_ORDER]).toEqual(EV.order);
  });
  for (const c of EV.cases) it(`${c.id} ${c.label}`, () => {
    const r = trackB(c.answers, { labs: c.labs });
    expect(r.products.map((p) => p.id)).toEqual(c.expected.products);
    expect(r.cards.map((x) => x.id)).toEqual(c.expected.cards);
  });
});

describe("트랙 B 문구", () => {
  it("고민 단어·금지어 없음 · 식약처 원문 분리 · «점검해 볼 필요» 표현", () => {
    for (const c of EV.cases) {
      const r = trackB(c.answers, { labs: c.labs });
      for (const p of r.products) {
        expect(p.text).toContain("섭취를 점검해 볼 필요가 있어요");
        expect(p.text).not.toContain("식약처");
        for (const w of ["피로", "면역", "개선", "예방", "치료", "부족해요"]) expect(p.text).not.toContain(w);
        for (const w of BANNED_WORDS) expect(p.text).not.toContain(w);
        expect(p.mfds.length).toBeGreaterThan(5);
      }
    }
    for (const t of Object.values(CARD_TEXT)) for (const w of BANNED_WORDS) expect(t).not.toContain(w);
  });
  it("엽산 문구: 임신 준비·임신 중 = 태아 신경관, 그 외 = 일반 기능성", () => {
    const base = EV.cases.find((c) => c.id === "T01")!.answers;
    expect(trackB({ ...base, 성별: "female", 임신단계: "임신준비" }).products[0].mfds).toBe("태아 신경관의 정상 발달에 필요");
    expect(trackB({ ...base, 성별: "female", 기저질환: ["임산부_수유부"] }).products[0].mfds).toBe("세포와 혈액생성에 필요");
  });
});

describe("트랙 B 연결", () => {
  it("검진 결과 → 신호 (중증은 referral)", () => {
    const cr = (need: string, level: string, ref = false) => ({ biomarker_key: "x", value: 1, level, label_ko: null, functional_needs: [need], tone: null, force_medical_referral: ref, matched_range_id: null });
    expect(labsFromCheckup([cr("철분보충", "low")])).toEqual({ ferritin: "low" });
    expect(labsFromCheckup([cr("철분보충", "low", true)])).toEqual({ ferritin: "referral" });
    expect(labsFromCheckup([cr("비타민D보충", "watch")])).toEqual({ vitamin_D: "low" });
    expect(labsFromCheckup([cr("간건강", "low")])).toEqual({});
  });
  it("H153 임신단계 임신중·수유중 = 임산부_수유부 차단 조건", () => {
    const a = { 성별: "female", 나이: 32, 신장: 160, 체중: 55, 체중변화: "변화없음", 증상: ["cant_fall_asleep"], 목표: ["수면개선"], 현재복용영양제: [], 기저질환: [], 가족력: [] } as SurveyAnswers;
    expect(runRecommendation(a).recommendations.map((r) => r.id)).toContain("gaba");
    expect(effectiveConditions({ ...a, 임신단계: "임신중" })).toContain("임산부_수유부");
    expect(runRecommendation({ ...a, 임신단계: "임신중" }).recommendations.map((r) => r.id)).not.toContain("gaba");
    expect(runRecommendation({ ...a, 임신단계: "수유중" }).recommendations.map((r) => r.id)).not.toContain("gaba");
  });
  it("설문 결과에 트랙 B 가 붙고, 트랙 A 에 있는 제품은 B 에서 빠짐", () => {
    const a = { 성별: "female", 나이: 35, 신장: 160, 체중: 55, 체중변화: "변화없음", 증상: [], 목표: ["피로회복"], 일조량: "매우_부족", 현재복용영양제: [], 기저질환: [], 가족력: [] } as SurveyAnswers;
    const r = runRecommendation(a);
    expect(r.nutrient_track?.products.map((p) => p.id)).toEqual(["vitamin_d"]);
    expect(trackB(a, { excludeIds: ["vitamin_d"] }).products).toEqual([]);
  });
});

describe("트랙 B 문장 이어 붙이기", () => {
  it("«면면»·«이면면» 같은 중복 없음 · 이유는 괄호 안", () => {
    for (const c of EV.cases) for (const p of trackB(c.answers, { labs: c.labs }).products) {
      expect(p.text).not.toMatch(/면면|이면이면/);
      expect(p.text).toMatch(/섭취를 점검해 볼 필요가 있어요\([^)]+\)\./);
    }
  });
});
