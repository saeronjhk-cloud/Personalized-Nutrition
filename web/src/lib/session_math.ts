/**
 * 정찬 세션 순수 로직(IO 없음 · Eval 대상).
 * 계약: IP 81(설계 LOCK)·82(서버 M1~M4). mealSession.ts(IO)가 사용.
 */
export type SessionErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_NOT_OPEN'
  | 'SESSION_OWNER_MISMATCH'
  | 'UNAUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN'

export const SESSION_ERR_MSG: Record<SessionErrorCode, string> = {
  SESSION_NOT_FOUND: '정찬을 찾을 수 없어요.',
  SESSION_NOT_OPEN: '이미 종료된 정찬이에요.',
  SESSION_OWNER_MISMATCH: '이 정찬에 접근할 수 없어요.',
  UNAUTHENTICATED: '로그인이 필요합니다.',
  VALIDATION_ERROR: '입력값을 확인해 주세요.',
  UNKNOWN: '정찬 처리에 실패했어요. 잠시 후 다시 시도해 주세요.',
}

/** RPC 예외 메시지(RAISE EXCEPTION 'CODE...')에서 알려진 코드를 한글 문구로. */
export function friendlySessionError(raw?: string): string {
  const s = String(raw ?? '')
  const codes: SessionErrorCode[] = [
    'SESSION_NOT_FOUND', 'SESSION_NOT_OPEN', 'SESSION_OWNER_MISMATCH', 'UNAUTHENTICATED', 'VALIDATION_ERROR',
  ]
  for (const c of codes) if (s.includes(c)) return SESSION_ERR_MSG[c]
  return SESSION_ERR_MSG.UNKNOWN
}

/** RPC 반환이 배열(table 반환)이든 단일이든 첫 행 안전 추출. */
export function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return data.length ? (data[0] as T) : null
  return (data ?? null) as T | null
}

/** 진행중 배지 문구. */
export function sessionBadgeText(plateCount: number, totalKcal: number): string {
  const n = Number.isFinite(plateCount) ? plateCount : 0
  const k = Number.isFinite(totalKcal) ? Math.round(totalKcal) : 0
  return `정찬 진행중 · ${n}개 접시 · 합계 ${k} kcal`
}
