/**
 * 목표 기반 식사 코칭 — 파라미터 단일 출처 (웹앱트랙 · 설계 v1 §4)
 *
 * 정본: IP/integration/goal_meal_coaching_design_v1.md §4 · 평가셋 IP/integration/goal_meal_coaching_eval_v1.md
 * 서박사 확정(IP/웹앱트랙_서박사_질의패킷_목표식사코칭_v1.md E1~E4·G2~G5)이 오면 «값만» 바꾼다. 로직 불변.
 * ✅ 2026-10-04 서박사 구두 승인 — 승인요청서(20260930) D1~D7 전 항목 «그대로». 기록 IP/웹앱트랙_서박사_회신기록부_코칭체계.md
 * ⚠ 값 변경 = 평가셋 기대 숫자만 갱신(케이스 삭제 금지). 확정 전 운영 ON 금지(VITE_GOAL_COACHING_ENABLED).
 */
import { UNDERWEIGHT_BMI } from "../goals/goals";

export interface GoalCoachingParams {
  /** 끼니 단백질 목표 g/kg (E1 a: Schoenfeld & Aragon 2018 0.4 g/kg/끼) — ⬜ 서박사 E1 */
  PER_MEAL_G_PER_KG: number;
  /** 노년 끼니 최소량(g). null = 보정 없음. 끼니목표 = max(g/kg 산출, 이 값) — ⬜ 서박사 E2 */
  ELDERLY_MIN_G: number | null;
  /** 노년 보정 적용 나이(이상) — ⬜ 서박사 E2 */
  ELDERLY_AGE: number;
  /** 부족률 임계 (≥ 이면 해당 강도) — ⬜ 서박사 E3 */
  SHORT_NORMAL: number;
  SHORT_STRONG: number;
  /** eGFR 이 값 «미만»이면 단백질 더하기 코칭 제외 — ⬜ 서박사 E4·G4 */
  EGFR_BLOCK: number;
  /** 설문 기저질환 중 제외 대상 — ⬜ 서박사 E4·G4 */
  EXCLUDE_CONDITIONS: readonly string[];
  /** 검진 요단백 저장 코드가 이 값 «이상»이면 단백질 더하기 코칭 제외(음성 0·약양성 0.5·양성 +1~+4 → 1~4)
   *  — 교차 확인 R1 Gemini·Codex 일치(양성부터, 약양성은 유지) · 서박사 사후 확인 대기 · IP/integration/checkup_coaching_link_eval_v1.md */
  URINE_PROTEIN_BLOCK: number;
  /** 체중관리 단독 사용자에게도 단백질 카드 (설계 §3-1 (B)) — ⬜ 서박사 G2 */
  WEIGHT_PROTEIN_CARD: boolean;
  /** 저체중 기준(BMI 미만이면 체중관리 기반 코칭 금지) — goals.ts UNDERWEIGHT_BMI 와 같은 값 */
  UNDERWEIGHT_BMI: number;
  /** 나트륨 코칭 (데이터 가드 설계 전 항상 false) — ⬜ 데이터 가드 + 서박사 G3 */
  SODIUM_COACHING: boolean;
}

export const DEFAULT_GOAL_COACHING_PARAMS: GoalCoachingParams = {
  PER_MEAL_G_PER_KG: 0.4,
  ELDERLY_MIN_G: 25,
  ELDERLY_AGE: 65,
  SHORT_NORMAL: 0.2,
  SHORT_STRONG: 0.4,
  EGFR_BLOCK: 60,
  EXCLUDE_CONDITIONS: ["신장질환"],
  URINE_PROTEIN_BLOCK: 1,
  WEIGHT_PROTEIN_CARD: true, // 서박사 D5 «그대로»(단백질 더하기 카드만) — 2026-10-04 구두 승인 · IP/웹앱트랙_서박사_회신기록부_코칭체계.md
  UNDERWEIGHT_BMI,
  SODIUM_COACHING: false,
};

/** 신장 안전 차단 사유(단백질 «더하기» 계열만 멈춤) — 끼니 문법·목표 카드·안내가 같은 판정을 쓴다(L14·L16).
 *  순서: 기저질환 → eGFR → 요단백. null 값은 판정 근거 없음(차단하지 않음, L04). */
export type KidneyBlockReason = "kidney_condition" | "egfr_low" | "urine_protein";
export function kidneyBlockReason(
  input: { conditions: readonly string[]; egfr: number | null; urineProtein?: number | null },
  p: Pick<GoalCoachingParams, "EXCLUDE_CONDITIONS" | "EGFR_BLOCK" | "URINE_PROTEIN_BLOCK"> = DEFAULT_GOAL_COACHING_PARAMS,
): KidneyBlockReason | null {
  if (input.conditions.some((c) => p.EXCLUDE_CONDITIONS.includes(c))) return "kidney_condition";
  if (input.egfr != null && Number.isFinite(input.egfr) && input.egfr < p.EGFR_BLOCK) return "egfr_low";
  const u = input.urineProtein;
  if (u != null && Number.isFinite(u) && u >= p.URINE_PROTEIN_BLOCK) return "urine_protein";
  return null;
}
