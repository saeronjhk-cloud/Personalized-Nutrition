/**
 * 설문 신체 정보 — 초기값 없음 + 유효성 + 과거 초기값 기록 판정 (순수)
 * 평가: IP/integration/survey_initial_values_eval_v1.md (V01~V20 · W1)
 */
import type { SurveyAnswers } from "../../types";

/** 설문 시작값: 성별 미선택 · 숫자 0 = 빈칸 */
export const EMPTY_BODY = { 성별: "", 나이: 0, 신장: 0, 체중: 0 } as const;

export const BODY_LIMITS = {
  age: { min: 10, max: 100 },
  height: { min: 100, max: 230 },
  weight: { min: 25, max: 250 },
} as const;

export type BodyIssue = "sex" | "age" | "height" | "weight";

type BodyLike = Pick<SurveyAnswers, "성별" | "나이" | "신장" | "체중">;

const inRange = (v: unknown, r: { min: number; max: number }) =>
  typeof v === "number" && Number.isFinite(v) && v >= r.min && v <= r.max;

export function bodyStepIssues(a: BodyLike): BodyIssue[] {
  const out: BodyIssue[] = [];
  if (a.성별 !== "male" && a.성별 !== "female") out.push("sex");
  if (!inRange(a.나이, BODY_LIMITS.age) || !Number.isInteger(a.나이)) out.push("age");
  if (!inRange(a.신장, BODY_LIMITS.height)) out.push("height");
  if (!inRange(a.체중, BODY_LIMITS.weight)) out.push("weight");
  return out;
}

const ISSUE_LABEL: Record<BodyIssue, string> = { sex: "성별", age: "나이", height: "키", weight: "몸무게" };

export function bodyIssueText(issues: readonly BodyIssue[]): string {
  if (issues.length === 0) return "";
  return `${issues.map((i) => ISSUE_LABEL[i]).join("·")}를 입력해 주세요`;
}

/** 2026-10 이전 설문은 170 cm·65 kg·30세를 미리 채운 채 시작 → 셋 다 일치하면 «초기값 그대로 제출» 의심 */
export function isLegacyDefaultBody(a: Partial<BodyLike> | null | undefined): boolean {
  return !!a && a.신장 === 170 && a.체중 === 65 && a.나이 === 30;
}

export interface TrustedBody {
  sex: string | null;
  sexKnown: boolean;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
}

/** 코칭·eGFR 입력용: 초기값 의심 기록은 신체값·성별을 미상으로 */
export function trustedBody(a: Partial<BodyLike> | null | undefined, sexKnown = true): TrustedBody {
  const pos = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  if (!a || isLegacyDefaultBody(a)) return { sex: null, sexKnown: false, age: null, heightCm: null, weightKg: null };
  return {
    sex: a.성별 ?? null,
    sexKnown: sexKnown && (a.성별 === "male" || a.성별 === "female"),
    age: pos(a.나이),
    heightCm: pos(a.신장),
    weightKg: pos(a.체중),
  };
}

/** 리포트 ⚖️ 신체 변화 노출 여부 */
export function showBodyChange(
  before: { answers: Partial<BodyLike>; bmi: number | null | undefined },
  after: { answers: Partial<BodyLike>; bmi: number | null | undefined },
): boolean {
  if (isLegacyDefaultBody(before.answers) || isLegacyDefaultBody(after.answers)) return false;
  return before.answers.체중 !== after.answers.체중 || before.bmi !== after.bmi;
}
