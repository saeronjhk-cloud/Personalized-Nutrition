/**
 * 검진 결과 → 식사 코칭 연결 힌트 (순수) — 서박사 회신 v2 ②④ (2026-10-14)
 * 평가 IP/integration/checkup_coaching_link_eval_v1.md v1.1 K01~K07·K12~K16 · ⚠ IO import 금지
 * 판정 = 기준표 level 그대로(새 판정 0). 상담 권장(force_medical_referral) 단계는 항상 제외 — 현행 상담 안내만.
 */
import type { CategoryResult } from "./engine";

/** ② 관찰 안내 대상 — 혈당·지질·혈압·간 수치 */
export const OBSERVE_KEYS: ReadonlySet<string> = new Set([
  "fasting_glucose", "HbA1c",
  "total_cholesterol", "LDL", "HDL", "triglyceride",
  "blood_pressure_systolic", "blood_pressure_diastolic",
  "AST", "ALT", "GGT",
]);

/** ② 서박사 승인 문구(2026-10-14 회신 v2) — 글자 바꾸지 말 것(K07) */
export const CHECKUP_OBSERVE_NOTE = "식사 기록을 이어 가면 다음 검진 때 식습관 흐름을 함께 살펴볼 수 있어요. 재검 시기는 의료진과 상의해 주세요.";

/** ④ 체중관리 목표 제안 문구 — 서박사 승인 «방식» 안의 초안(사후 확인 40_문구확인표.md) */
export const WEIGHT_GOAL_SUGGEST_TEXT = "체중관리 목표를 켜면, 식사 기록에 맞춰 반찬 하나를 단백질 반찬으로 바꾸는 방법을 알려 드려요.";
export const WEIGHT_GOAL_SUGGEST_BUTTON = "체중관리 목표 켜기";
export const WEIGHT_GOAL_SUGGEST_DONE = "체중관리 목표를 켰어요.";

const isWatch = (r: CategoryResult) => r.level === "watch" && !r.force_medical_referral;

/** ② watch 단계인 관찰 대상 항목 키(상담 권장·low·normal 제외) */
export function observeKeysFor(results: readonly CategoryResult[]): Set<string> {
  return new Set(results.filter((r) => OBSERVE_KEYS.has(r.biomarker_key) && isWatch(r)).map((r) => r.biomarker_key));
}

/** ④ BMI watch(참고범위보다 높음, 상담 권장 아님) · 체중관리 목표 꺼짐 → 제안 */
export function shouldSuggestWeightGoal(results: readonly CategoryResult[], goals: readonly string[] | null): boolean {
  if (goals === null) return false; // 목표를 모르면 제안하지 않음(이미 켠 사람에게 중복 제안 방지)
  if (goals.includes("체중관리")) return false;
  return results.some((r) => r.biomarker_key === "BMI" && isWatch(r));
}
