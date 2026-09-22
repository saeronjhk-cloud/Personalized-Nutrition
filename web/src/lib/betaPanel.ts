/**
 * 사진 수집 베타 패널 (세션54 · 2026-09-22)
 *
 * 무엇인가
 *   별도 빌드가 아니다. 제이가 보내는 링크 `/beta` 에서 참여 플래그를 켜면, 그 브라우저에서만
 *   (1) 식사 페이지 상단에 «패널 배너», (2) 결과 화면에 「의견 보내기」 버튼이 보인다.
 *   일반 사용자 화면은 그대로다.
 *
 * 왜 필요한가
 *   프로덕션 엔진 발화율을 재려면 «한식 밥·탕 사진»이 실사용 경로로 들어와야 하는데(IP/181 §1-2),
 *   제이 혼자서는 안 쌓인다. 패널 5~10명 × 2주.
 *   피드백은 app_event 가 아니라 beta_feedback 테이블에 «job_id 와 함께» 저장한다 — 어느 사진에
 *   대한 말인지 SQL 로 바로 잇기 위해서다(151_beta_feedback_v1.sql).
 *
 * 플래그는 localStorage 다. 기기·브라우저마다 따로 켜진다 = 링크를 누른 그 폰에서만 패널 UI 가 보인다.
 */
import { supabase } from './supabase'

export const BETA_PANEL_KEY = 'sf_beta_panel'          // '1' | null
export const BETA_PANEL_VERSION = 'photo_panel_2026_09'  // 회차 구분용(다음 패널 때 바꾼다)

/** ⚠ 151_beta_feedback_v1.sql 의 CHECK(kind in …) 와 «글자까지» 같아야 한다. */
export const FEEDBACK_KINDS = [
  { key: 'correction', label: '음식명이 틀렸어요', hint: '맞는 음식명을 적어 주세요 (예: 곰탕)' },
  { key: 'bug',        label: '오류·버그',        hint: '어떤 화면에서 무엇이 안 됐는지' },
  { key: 'opinion',    label: '의견·제안',        hint: '자유롭게' },
] as const
export type FeedbackKind = typeof FEEDBACK_KINDS[number]['key']

export function isBetaPanel(): boolean {
  try { return localStorage.getItem(BETA_PANEL_KEY) === '1' } catch { return false }
}
export function joinBetaPanel(): void {
  try { localStorage.setItem(BETA_PANEL_KEY, '1') } catch { /* 저장 불가 환경 — UI 만 안 보일 뿐 */ }
}
export function leaveBetaPanel(): void {
  try { localStorage.removeItem(BETA_PANEL_KEY) } catch { /* noop */ }
}

export interface FeedbackInput {
  kind: FeedbackKind
  message: string
  jobId?: string | null
  foodName?: string | null
  page?: string
}

/**
 * 피드백 저장. 실패는 삼키지 않고 돌려준다 — track() 의 fire-and-forget 이 2026-08-06 에
 * «한 건도 안 쌓인 채 지표로 쓰인» 사고(IP/179 §2-4)를 되풀이하지 않기 위해서다.
 */
export async function sendFeedback(input: FeedbackInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = input.message.trim()
  if (!message) return { ok: false, error: '내용을 적어 주세요.' }
  if (message.length > 1000) return { ok: false, error: '1000자 이내로 적어 주세요.' }
  const foodName = input.kind === 'correction' ? (input.foodName ?? '').trim().slice(0, 60) || null : null
  const row = {
    kind: input.kind,
    message,
    job_id: input.jobId || null,
    food_name: foodName,
    page: (input.page ?? '/meal').slice(0, 80),
  }
  const { error } = await supabase.from('beta_feedback').insert(row)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
