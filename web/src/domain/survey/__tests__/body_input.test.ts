/** IP/integration/survey_initial_values_eval_v1.md — V01~V20 · W1 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EMPTY_BODY, bodyIssueText, bodyStepIssues, isLegacyDefaultBody, showBodyChange, trustedBody,
} from "../body_input";

const ok = { 성별: "male", 나이: 45, 신장: 175, 체중: 72 };

describe("설문 신체 정보 초기값 제거", () => {
  it("V01 빈 시작값은 네 항목 모두 미입력", () => {
    expect(bodyStepIssues({ ...EMPTY_BODY })).toEqual(["sex", "age", "height", "weight"]);
  });
  it("V02 유효 입력", () => expect(bodyStepIssues(ok)).toEqual([]));
  it("V03 키만 빈칸", () => expect(bodyStepIssues({ ...ok, 성별: "female", 신장: 0 })).toEqual(["height"]));
  it("V04 성별 이상값", () => expect(bodyStepIssues({ ...ok, 성별: "other" })).toEqual(["sex"]));
  it("V05 나이 9", () => expect(bodyStepIssues({ ...ok, 나이: 9 })).toEqual(["age"]));
  it("V06 나이 101", () => expect(bodyStepIssues({ ...ok, 나이: 101 })).toEqual(["age"]));
  it("V07 나이 소수", () => expect(bodyStepIssues({ ...ok, 나이: 45.5 })).toEqual(["age"]));
  it("V08 키 범위", () => {
    expect(bodyStepIssues({ ...ok, 신장: 99 })).toEqual(["height"]);
    expect(bodyStepIssues({ ...ok, 신장: 231 })).toEqual(["height"]);
  });
  it("V09 몸무게 범위", () => {
    expect(bodyStepIssues({ ...ok, 체중: 24.9 })).toEqual(["weight"]);
    expect(bodyStepIssues({ ...ok, 체중: 250.1 })).toEqual(["weight"]);
  });
  it("V10 몸무게 소수 허용", () => expect(bodyStepIssues({ ...ok, 체중: 72.5 })).toEqual([]));
  it("V11 NaN 키", () => expect(bodyStepIssues({ ...ok, 신장: Number.NaN })).toEqual(["height"]));
  it("V12~V14 초기값 의심 판정", () => {
    expect(isLegacyDefaultBody({ 신장: 170, 체중: 65, 나이: 30 })).toBe(true);
    expect(isLegacyDefaultBody({ 신장: 170, 체중: 65, 나이: 31 })).toBe(false);
    expect(isLegacyDefaultBody({ 신장: 180, 체중: 82, 나이: 58 })).toBe(false);
    expect(isLegacyDefaultBody(null)).toBe(false);
  });
  it("V15 초기값 기록은 전부 미상", () => {
    expect(trustedBody({ 성별: "male", 신장: 170, 체중: 65, 나이: 30 })).toEqual({
      sex: null, sexKnown: false, age: null, heightCm: null, weightKg: null,
    });
  });
  it("V16 실값 기록은 그대로", () => {
    expect(trustedBody({ 성별: "male", 신장: 180, 체중: 82, 나이: 58 }, true)).toEqual({
      sex: "male", sexKnown: true, age: 58, heightCm: 180, weightKg: 82,
    });
    expect(trustedBody({ 성별: "male", 신장: 180, 체중: 82, 나이: 58 }, false).sexKnown).toBe(false);
  });
  it("V17 안내 문구", () => expect(bodyIssueText(["age", "weight"])).toBe("나이·몸무게를 입력해 주세요"));
  it("V18 13세는 범위 안(제출 백스톱이 차단)", () => expect(bodyStepIssues({ ...ok, 나이: 13 })).toEqual([]));
  it("V19 한쪽이 초기값이면 신체 변화 숨김", () => {
    expect(showBodyChange(
      { answers: { 신장: 170, 체중: 65, 나이: 30 }, bmi: 22.5 },
      { answers: { 신장: 180, 체중: 82, 나이: 58 }, bmi: 25.3 },
    )).toBe(false);
  });
  it("V20 실값끼리는 변화 있을 때만", () => {
    const a = { answers: { 신장: 180, 체중: 82, 나이: 58 }, bmi: 25.3 };
    expect(showBodyChange(a, { ...a })).toBe(false);
    expect(showBodyChange(a, { answers: { 신장: 180, 체중: 80, 나이: 58 }, bmi: 24.7 })).toBe(true);
  });
  it("W1 App.tsx 시작값은 EMPTY_BODY", () => {
    const src = readFileSync(resolve(__dirname, "../../../App.tsx"), "utf8");
    const block = src.slice(src.indexOf("const INITIAL_ANSWERS"), src.indexOf("function SurveyFlow"));
    expect(block).toContain("EMPTY_BODY");
    expect(block).not.toMatch(/신장:\s*170|체중:\s*65|나이:\s*30|성별:\s*'male'/);
  });
});
