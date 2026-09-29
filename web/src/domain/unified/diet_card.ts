/**
 * «내 건강» 🥗 식이 카드 상태 판정 (Phase H) — 순수 함수.
 * 임계는 추천 엔진(diet_adapter)의 DIET_MIN_DAYS 를 그대로 쓴다 → 카드와 추천 «참조한 기록»이 같은 말을 한다.
 * 식이 코칭 문구는 만들지 않는다(D5: 서박사 확정 영역).
 * 평가셋: IP/integration/phase_h_diet_card_eval_v1.md
 */
import { DIET_MIN_DAYS } from "./diet_adapter";

export const DIET_CARD_WINDOW_DAYS = 7;

export type DietCardKind = "soon" | "guest" | "error" | "none" | "low" | "ok";
export type DietCardTone = "done" | "todo" | "soon";

export interface DietCardStatus {
  kind: DietCardKind;
  badge: string;
  tone: DietCardTone;
  /** 추천 반영까지 더 필요한 기록 일수 (low 일 때만 > 0) */
  remainingDays: number;
  /** 최근 창 안의 기록 일수 (0~windowDays) */
  days: number;
}

export interface DietCardInput {
  mealEnabled: boolean;
  isLoggedIn: boolean;
  /** 조회 결과: 기록 일수, 또는 조회 실패면 null */
  days: number | null;
  windowDays?: number;
}

export function dietCardStatus(input: DietCardInput): DietCardStatus {
  const windowDays = input.windowDays ?? DIET_CARD_WINDOW_DAYS;
  if (!input.mealEnabled) return { kind: "soon", badge: "준비 중", tone: "soon", remainingDays: 0, days: 0 };
  if (!input.isLoggedIn) return { kind: "guest", badge: "미입력", tone: "todo", remainingDays: 0, days: 0 };
  if (input.days === null) return { kind: "error", badge: "불러오지 못했어요", tone: "soon", remainingDays: 0, days: 0 };

  const days = Math.max(0, Math.min(windowDays, Math.floor(input.days)));
  if (days === 0) return { kind: "none", badge: "기록 없음", tone: "todo", remainingDays: DIET_MIN_DAYS, days };
  if (days < DIET_MIN_DAYS) {
    const remainingDays = DIET_MIN_DAYS - days;
    return {
      kind: "low",
      badge: `최근 ${windowDays}일 중 ${days}일 기록 · ${remainingDays}일 더 기록하면 추천에 반영`,
      tone: "todo",
      remainingDays,
      days,
    };
  }
  return { kind: "ok", badge: `최근 ${windowDays}일 중 ${days}일 기록 · 추천에 반영 중`, tone: "done", remainingDays: 0, days };
}
