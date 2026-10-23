/**
 * 추천 제외 원료 (2026-10-23 제이 결정 «빼는 쪽으로 진행») — 식약처 기능성(고시·개별인정) 근거가 없는 원료는 추천하지 않는다(H149).
 * 근거: IP/integration/mfds_function_v1/00_식약처기능성문구_대조_20261023.md · 평가셋 IP/evals/eval_not_recommended_v1.json
 * 데이터(SUPPLEMENTS)는 지우지 않는다 — 예전 설문 기록의 결과 화면·쿠팡 링크 표시가 깨지지 않게.
 */
export const NOT_RECOMMENDED: Readonly<Record<string, string>> = {
  lemon_balm: "레몬밤 — 수면·스트레스 기능성 인정 없음(레몬밤 인정 = 체지방 감소·간 건강, 이 앱의 추천 용도와 다름)",
  red_clover: "레드클로버 — 고시·개별인정 없음",
};

export function isRecommendable(id: string): boolean {
  return !Object.prototype.hasOwnProperty.call(NOT_RECOMMENDED, id);
}
