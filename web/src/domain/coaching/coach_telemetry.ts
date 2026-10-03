/**
 * 코칭 카드 노출 계측 — 카드 id·props·하루 1회 판정 (순수)
 * 평가: IP/integration/coach_card_telemetry_eval_v1.md (T01~T15)
 * ⚠ IO import 금지. 건강 수치·음식명·g 값은 props 에 넣지 않는다(익명 sink).
 */
import type { GrammarRuleId } from "./meal_grammar_params";
import { localDayKey } from "./meal_grammar";

export type CoachCardId = "g_pro" | "g_veg" | "g_am" | "v1_protein";

const RULE_TO_ID: Record<GrammarRuleId, CoachCardId> = { "G-PRO": "g_pro", "G-VEG": "g_veg", "G-AM": "g_am" };

export function coachCardId(rule: GrammarRuleId): CoachCardId {
  return RULE_TO_ID[rule];
}

export function shownKey(now: Date, card: CoachCardId): string {
  return `coach_shown:${localDayKey(now)}:${card}`;
}

export interface KV { get(k: string): string | null; set(k: string, v: string): void }

/** 같은 날·같은 카드 1회. 저장소 오류면 전송(누락보다 중복이 낫다). */
export function shouldTrackShown(store: KV, now: Date, card: CoachCardId): boolean {
  const k = shownKey(now, card);
  try {
    if (store.get(k)) return false;
  } catch {
    return true;
  }
  try { store.set(k, "1"); } catch { /* 무시 */ }
  return true;
}

export function grammarShownProps(card: { rule: GrammarRuleId }): { coach_card: CoachCardId } {
  return { coach_card: coachCardId(card.rule) };
}

export function v1ShownProps(card: { level: "normal" | "strong" }): { coach_card: CoachCardId; coach_level: "normal" | "strong" } {
  return { coach_card: "v1_protein", coach_level: card.level };
}
