/**
 * 잔반 보정 순수 로직(IO 없음 · Eval 대상).
 * 계약: IP 통합앱_P1/40·27_v2.1.1. mealLeftover.ts(IO)가 이 헬퍼를 사용.
 */
export type LeftoverErrorCode =
  | 'VALIDATION_ERROR'
  | 'SESSION_STILL_OPEN'
  | 'IDEMPOTENCY_KEY_REUSE_MISMATCH'
  | 'AI_ESTIMATE_FAILED'
  | 'UNKNOWN'

export interface ParsedEnvelope {
  ok: boolean
  data?: any
  errorCode?: LeftoverErrorCode
  errorMessage?: string
}

export const LEFTOVER_ERR_MSG: Record<LeftoverErrorCode, string> = {
  VALIDATION_ERROR: '입력값을 확인해 주세요.',
  SESSION_STILL_OPEN: '정찬이 진행 중이에요. 정찬을 종료한 뒤 먹은 양을 조절할 수 있어요.',
  IDEMPOTENCY_KEY_REUSE_MISMATCH: '요청이 겹쳤어요. 잠시 후 다시 시도해 주세요.',
  AI_ESTIMATE_FAILED: '사진 분석에 실패했어요. 슬라이더로 입력해 주세요.',
  UNKNOWN: '먹은 양 반영에 실패했어요. 잠시 후 다시 시도해 주세요.',
}

/** 0~1로 클램프 + 0.01 단위 반올림. NaN/비수치는 1(전부 먹음)로 안전 처리. */
export function clampRatio(x: number): number {
  if (typeof x !== 'number' || !isFinite(x)) return 1
  if (x < 0) return 0
  if (x > 1) return 1
  return Math.round(x * 100) / 100
}

/** 입력 유효성(0~1, 유한수). UI/서버 이중 방어. */
export function isValidRatio(x: number): boolean {
  return typeof x === 'number' && isFinite(x) && x >= 0 && x <= 1
}

/** 단건 슬라이더 요청 바디. pre_summary/pre_result는 절대 포함하지 않음. */
export function buildSliderBody(preMealLogId: string, eatenRatio: number) {
  return {
    pre_meal_log_id: preMealLogId,
    leftover_method: 'slider' as const,
    eaten_ratio: clampRatio(eatenRatio),
  }
}

/** 정찬 세션 전체 슬라이더 요청 바디(종료된 세션 대상). */
export function buildSessionSliderBody(preMealSessionId: string, sessionEatenRatio: number) {
  return {
    pre_meal_session_id: preMealSessionId,
    leftover_method: 'slider' as const,
    session_eaten_ratio: clampRatio(sessionEatenRatio),
  }
}

/** 에러코드 → 사용자용 한글 문구. */
export function friendlyLeftoverError(code?: string): string {
  return LEFTOVER_ERR_MSG[(code as LeftoverErrorCode)] || LEFTOVER_ERR_MSG.UNKNOWN
}

/** Envelope { ok, data, error:{code,message} } 파싱 + 에러코드 정규화. */
export function parseLeftoverEnvelope(json: any, httpStatus: number): ParsedEnvelope {
  const data = json?.data
  if (json?.ok && data) return { ok: true, data }
  const raw = json?.error?.code as string | undefined
  const code: LeftoverErrorCode =
    raw && Object.prototype.hasOwnProperty.call(LEFTOVER_ERR_MSG, raw) && raw !== 'UNKNOWN'
      ? (raw as LeftoverErrorCode)
      : httpStatus === 401
        ? 'VALIDATION_ERROR'
        : 'UNKNOWN'
  return { ok: false, errorCode: code, errorMessage: friendlyLeftoverError(code) }
}

/** 멱등키(uuid). 브라우저/Node crypto 우선. */
export function genIdemKey(): string {
  const c = (typeof crypto !== 'undefined' ? (crypto as any) : undefined)
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return 'k-' + Date.now().toString(36) + '-' + Math.random().toString(16).slice(2)
}

// ───────── Path B (식후사진 AI) 순수 헬퍼 ─────────

/** suggest(제안) 요청 바디. after_image는 base64(접두사 제외). */
export function buildPhotoAiSuggestBody(preMealLogId: string, afterImageBase64: string, mime = 'image/jpeg') {
  return {
    pre_meal_log_id: preMealLogId,
    leftover_method: 'photo_ai' as const,
    after_image: afterImageBase64,
    after_image_mime: mime,
  }
}

/** confirm(확인) 요청 바디. 결정론(원본×confirmed_ratio). */
export function buildPhotoAiConfirmBody(preMealLogId: string, confirmedEatenRatio: number) {
  return {
    pre_meal_log_id: preMealLogId,
    leftover_method: 'photo_ai' as const,
    confirmed_eaten_ratio: clampRatio(confirmedEatenRatio),
  }
}

export interface PhotoAiSuggestion {
  state?: string
  estimatedEatenRatio: number
  confidence: number
  requiresConfirmation: boolean
  suggestedNote: string
  /** 미리보기 전용(아직 저장 아님) */
  previewSummary: any
}

/** suggest 응답 data 정규화. 확인은 항상 거치므로 requiresConfirmation 기본 true(안전). */
export function parsePhotoAiSuggest(data: any): PhotoAiSuggestion {
  return {
    state: data?.state,
    estimatedEatenRatio: clampRatio(Number(data?.estimated_eaten_ratio)),
    confidence: Number.isFinite(Number(data?.confidence)) ? Number(data?.confidence) : 0,
    requiresConfirmation: data?.requires_user_confirmation !== false,
    suggestedNote: String(data?.suggested_note ?? '남긴 양을 확인해 주세요.'),
    previewSummary: data?.adjusted_summary ?? null,
  }
}
