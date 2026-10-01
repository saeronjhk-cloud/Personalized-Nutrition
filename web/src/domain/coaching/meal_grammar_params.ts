/**
 * 한식 끼니 문법 P1 — 파라미터 단일 출처 (설계 IP/integration/meal_grammar_p1_design_v1.md §5·§6)
 * 값 변경 = 평가셋(IP/integration/meal_grammar_p1_eval_v1.md) 기대값만 갱신, 케이스 삭제 금지.
 */
export type GrammarRuleId = "G-PRO" | "G-VEG" | "G-AM";

export interface MealGrammarParams {
  /** 검증 창(오늘 포함 일수) */
  VERIFY_WINDOW_DAYS: number;
  /** 졸업 성공률(≥) */
  GRADUATE_RATE: number;
  /** 졸업에 필요한 최소 기회 수 */
  GRADUATE_MIN_OPPS: number;
  /** P1 고정 순서 (P2 에서 병목 선택기로 교체) */
  ORDER: readonly GrammarRuleId[];
}

export const DEFAULT_MEAL_GRAMMAR_PARAMS: MealGrammarParams = {
  VERIFY_WINDOW_DAYS: 14,
  GRADUATE_RATE: 0.8,
  GRADUATE_MIN_OPPS: 7,
  ORDER: ["G-PRO", "G-VEG", "G-AM"],
};
