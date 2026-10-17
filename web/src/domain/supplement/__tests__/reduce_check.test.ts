/** 지금 드시는 영양제 점검 v1 — IP/integration/supplement_reduce_v1/10_회신·제이결정_확정문구_평가셋_v1.md S01~S16 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reduceCheck, ironSymptomIds, REDUCE_TEXT } from "../reduce_check";
import { BANNED_WORDS } from "../../checkup/compliance";
import { SUPPLEMENT_CHECK_ENABLED } from "../../../lib/flags";
import type { SurveyAnswers } from "../../../types";

const A = (o: Partial<SurveyAnswers>): SurveyAnswers =>
  ({ 성별: "female", 나이: 30, 신장: 160, 체중: 55, 체중변화: "", 증상: [], 목표: [], 현재복용영양제: [], 기저질환: [], 가족력: [], ...o }) as SurveyAnswers;
const ids = (a: SurveyAnswers) => reduceCheck(a).map((l) => l.id);

describe("S 영양제 점검", () => {
  it("S01 복용 없음", () => expect(reduceCheck(A({}))).toEqual([]));
  it("S02 종합비타민+비타민D", () =>
    expect(reduceCheck(A({ 현재복용영양제: ["multivitamin", "vitamin_d"] }))[0].text)
      .toBe("종합비타민에도 비타민D가 포함되어 있을 수 있어요. 각 제품의 1일 섭취량 기준 함량을 합산해 라벨에서 확인해 보세요."));
  it("S03 종합비타민+칼슘+비타민C → 선택지 순서·받침 조사", () =>
    expect(reduceCheck(A({ 현재복용영양제: ["calcium", "multivitamin", "vitamin_c"] }))[0].text).toContain("비타민C·칼슘이 포함"));
  it("S04 종합비타민 단독", () => expect(reduceCheck(A({ 현재복용영양제: ["multivitamin"] }))).toEqual([]));
  it("S05 철분+칼슘(여성 30세 정상)", () => expect(ids(A({ 현재복용영양제: ["iron", "calcium"], 월경상태: "정상" }))).toEqual(["GAP"]));
  it("S06 철분+마그네슘은 간격 안내 아님", () => expect(ids(A({ 현재복용영양제: ["iron", "magnesium"], 월경상태: "정상" }))).toEqual([]));
  it("S07 남성 철분 · 증상 없음", () => expect(ids(A({ 성별: "male", 현재복용영양제: ["iron"] }))).toEqual(["IRON"]));
  it("S08 남성 철분 · 철분 연결 증상 있음", () => {
    expect(ironSymptomIds()).toContain("chronic_fatigue");
    expect(ids(A({ 성별: "male", 현재복용영양제: ["iron"], 증상: ["chronic_fatigue"] }))).toEqual([]);
  });
  it("S09 여성 40세 월경 정상", () => expect(ids(A({ 나이: 40, 월경상태: "정상", 현재복용영양제: ["iron"] }))).toEqual([]));
  it("S10 여성 폐경(45세)", () => expect(ids(A({ 나이: 45, 월경상태: "폐경", 현재복용영양제: ["iron"] }))).toEqual(["IRON"]));
  it("S11 여성 월경 미응답 55세", () => expect(ids(A({ 나이: 55, 현재복용영양제: ["iron"] }))).toEqual(["IRON"]));
  it("S12 임산부·수유부", () => expect(ids(A({ 성별: "female", 나이: 55, 기저질환: ["임산부_수유부"], 현재복용영양제: ["iron"] }))).toEqual([]));
  it("S13 5가지", () =>
    expect(ids(A({ 현재복용영양제: ["omega3", "probiotics", "lutein", "collagen", "coq10"] }))).toEqual(["MANY"]));
  it("S14 해당 4개 → 최대 2줄 IRON·GAP", () =>
    expect(ids(A({ 성별: "male", 현재복용영양제: ["iron", "calcium", "multivitamin", "omega3", "lutein"] }))).toEqual(["IRON", "GAP"]));
  it("S15 문구 금지어·끊으라는 말 0 · 끝 «요.»", () => {
    for (const t of Object.values(REDUCE_TEXT)) {
      for (const w of [...BANNED_WORDS, "끊", "중단"]) expect(t).not.toContain(w);
      expect(t.endsWith("요.")).toBe(true);
    }
  });
  it("S16 화면 연결 · 기본 OFF", () => {
    expect(SUPPLEMENT_CHECK_ENABLED).toBe(false);
    const src = readFileSync(resolve(__dirname, "../../../pages/Results.tsx"), "utf-8");
    expect(src).toContain("SUPPLEMENT_CHECK_ENABLED ? reduceCheck(answers) : []");
    expect(src).toContain('data-testid="supplement-check"');
    expect(src).not.toContain("철분은 몸에 쌓이기");
  });
});
