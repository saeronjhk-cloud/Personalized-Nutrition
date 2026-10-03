/**
 * 코칭 카드 노출 계측 — IO 배선 (판정은 domain/coaching/coach_telemetry.ts)
 * 평가: IP/integration/coach_card_telemetry_eval_v1.md · DB: supabase/154_app_event_coach_v1.sql
 */
import { track } from './events'
import { shouldTrackShown, type CoachCardId, type KV } from '../domain/coaching/coach_telemetry'

const browserKV: KV = {
  get: (k) => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
}

export function trackCoachShown(props: { coach_card: CoachCardId; coach_level?: 'normal' | 'strong' }): void {
  if (!shouldTrackShown(browserKV, new Date(), props.coach_card)) return
  track('coach_card_shown', props)
}

export function trackCoachWhyOpen(card: CoachCardId): void {
  track('coach_why_open', { coach_card: card })
}
