/**
 * «새 글» 팝업 등장 판정(순수) — 방문자 홈은 히어로 버튼을 지나 스크롤한 뒤에만(첫 화면 보호)
 * 평가 IP/integration/home_redesign_v2_eval_v1.md §6 V27
 */
export type PopupGate = 'show' | 'wait';

export function popupGate(input: { deferUntilPast?: string | null; anchorBottom: number | null }): PopupGate {
  if (!input.deferUntilPast) return 'show';
  // 기준 요소를 못 찾으면(다른 모드로 바뀜 등) 막지 않는다
  if (input.anchorBottom === null) return 'show';
  return input.anchorBottom < 0 ? 'show' : 'wait';
}

/** 등장 지연(ms): 일반 3초(현행) · 스크롤로 열린 경우 짧게 */
export function popupDelayMs(deferred: boolean): number {
  return deferred ? 600 : 3000;
}
