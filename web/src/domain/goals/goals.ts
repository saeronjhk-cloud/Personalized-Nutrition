/**
 * 건강 목표 — 순수 로직 (웹앱트랙 Phase G · 목표를 «식사 기록»으로 이전)
 *
 * 무엇이 바뀌었나
 *   - 목표의 «입력·편집 위치»가 설문 3단계 → 식사 기록(/meal) «내 건강 목표» 카드로 이동.
 *   - 저장소: public.user_goals (web/supabase/152_user_goals_v1.sql).
 *   - 엔진(scorer goalBoostMap · calculateProteinTarget)은 «수정하지 않는다».
 *     목표의 «출처»만 바꿔 answers.목표 로 주입한다 (IP/integration/phase_g_goal_move_eval_v1.md).
 *
 * 제이 결정 (2026-09-28, 웹앱트랙 인수인계 §3)
 *   D1 13종 전부 이전 · D2 비로그인 설문만 목표 단계 유지 · D5 저장·편집·추천 반영까지만.
 */
import type { SurveyAnswers, Step } from "../../types";

export interface GoalOption {
  id: string;
  emoji: string;
  label: string;
}

/** 목표 13종 — scorer.ts goalBoostMap 키와 «글자까지» 같아야 한다 (goal_move.test 가 대조). */
export const GOAL_OPTIONS: GoalOption[] = [
  { id: "피로회복", emoji: "💪", label: "피로회복" },
  { id: "수면개선", emoji: "😴", label: "수면개선" },
  { id: "면역력강화", emoji: "🛡️", label: "면역력강화" },
  { id: "체중관리", emoji: "⚖️", label: "체중 / 체지방 관리" },
  { id: "간건강", emoji: "🍺", label: "간건강" },
  { id: "소화장건강", emoji: "🦠", label: "소화장건강" },
  { id: "근육증가", emoji: "🏋️", label: "근육증가" },
  { id: "피부개선", emoji: "✨", label: "피부개선" },
  { id: "혈당관리", emoji: "🩸", label: "혈당관리" },
  { id: "눈건강", emoji: "👁️", label: "눈건강" },
  { id: "심혈관건강", emoji: "❤️", label: "심혈관건강" },
  { id: "갱년기관리", emoji: "🌸", label: "갱년기관리" },
  { id: "인지력향상", emoji: "🧠", label: "인지력향상" },
];

const KNOWN = new Set(GOAL_OPTIONS.map((g) => g.id));

/** 알 수 없는 값 제거 + 중복 제거 + 정의 순서로 정렬(저장·비교 안정성). */
export function sanitizeGoals(goals: readonly string[] | null | undefined): string[] {
  const set = new Set((goals ?? []).filter((g) => KNOWN.has(g)));
  return GOAL_OPTIONS.map((g) => g.id).filter((id) => set.has(id));
}

/**
 * 결과 화면 «반영한 목표» 표기용 (Phase G 후속 2026-09-30).
 *  - null  → hidden (목표 출처 없음: MEAL_ENABLED=false 등 — 설문 안 목표를 그대로 씀)
 *  - 유효 0개 → empty («건강 목표가 아직 없어요» 안내)
 *  - 1개 이상 → 정의 순서 화면 라벨
 */
export type GoalSummary = { kind: "hidden" } | { kind: "empty" } | { kind: "goals"; labels: string[] };

export function goalSummary(goals: readonly string[] | null): GoalSummary {
  if (goals === null) return { kind: "hidden" };
  const ids = sanitizeGoals(goals);
  if (ids.length === 0) return { kind: "empty" };
  const byId = new Map(GOAL_OPTIONS.map((g) => [g.id, g.label]));
  return { kind: "goals", labels: ids.map((id) => byId.get(id) ?? id) };
}

export type GoalSource = "user_goals" | "survey_fallback" | "none";

/**
 * 유효 목표 결정.
 *  - user_goals 행이 있으면(빈 배열이라도 «사용자가 비웠다»는 뜻) 그대로.
 *  - 행이 없으면(null) 최신 설문 goals 로 폴백 + 1회 시드 필요.
 *    (기존 사용자 목표 유실 방지 — G02·G15)
 */
export function resolveEffectiveGoals(
  userGoals: readonly string[] | null,
  latestSurveyGoals: readonly string[] | null,
): { goals: string[]; source: GoalSource; needsSeed: boolean } {
  if (userGoals !== null) {
    return { goals: sanitizeGoals(userGoals), source: "user_goals", needsSeed: false };
  }
  const fb = sanitizeGoals(latestSurveyGoals);
  if (fb.length > 0) return { goals: fb, source: "survey_fallback", needsSeed: true };
  return { goals: [], source: "none", needsSeed: false };
}

/**
 * 섭식 안전장치 (IP/155 §2 참고선 · 임계 확정 전 보수안)
 *   BMI < 18.5 → «체중관리»(감량 성격) 목표 선택 금지.
 *   BMI 미상(null) → 차단 근거가 없으므로 허용 (신장·체중은 설문에서만 온다).
 */
export const UNDERWEIGHT_BMI = 18.5;
export const BMI_BLOCKED_GOALS = ["체중관리"] as const;

export function isGoalBlockedByBmi(goalId: string, bmi: number | null | undefined): boolean {
  if (bmi == null || !Number.isFinite(bmi)) return false;
  return bmi < UNDERWEIGHT_BMI && (BMI_BLOCKED_GOALS as readonly string[]).includes(goalId);
}

/** 저장 직전 검증: 차단 목표는 걸러내고 무엇을 걸렀는지 돌려준다. */
export function validateGoalsForSave(
  goals: readonly string[],
  bmi: number | null | undefined,
): { goals: string[]; rejected: string[] } {
  const clean = sanitizeGoals(goals);
  const rejected = clean.filter((g) => isGoalBlockedByBmi(g, bmi));
  return { goals: clean.filter((g) => !rejected.includes(g)), rejected };
}

export function bmiFromAnswers(a: Pick<SurveyAnswers, "신장" | "체중"> | null | undefined): number | null {
  if (!a || !a.신장 || !a.체중) return null;
  const m = a.신장 / 100;
  return a.체중 / (m * m);
}

/** 설문 답변의 목표만 교체 (엔진 입력 주입). 원본 불변. */
export function withGoals(answers: SurveyAnswers, goals: readonly string[]): SurveyAnswers {
  return { ...answers, 목표: [...goals] };
}

/**
 * D2: 설문에서 목표 단계를 건너뛰나?
 *   로그인 + 식사 기록 기능이 켜져 있을 때만 건너뛴다.
 *   ⚠ MEAL_ENABLED=false 면 /meal 자체가 없어 목표를 넣을 곳이 없다 → 설문 단계 유지.
 */
export function shouldSkipGoalStep(opts: { loggedIn: boolean; mealEnabled: boolean }): boolean {
  return opts.loggedIn && opts.mealEnabled;
}

const ALL_SURVEY_STEPS: Step[] = ["body", "symptoms", "goals", "sleep", "stress", "exercise", "diet", "alcohol", "supplements", "conditions"];

/** 설문 단계 목록 — 목표 단계 건너뛰기(D2) 반영. */
export function surveySteps(skipGoals: boolean): Step[] {
  return skipGoals ? ALL_SURVEY_STEPS.filter((s) => s !== "goals") : ALL_SURVEY_STEPS;
}
