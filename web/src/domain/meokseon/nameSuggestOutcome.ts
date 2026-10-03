/**
 * ★ 세션74 U73-1 — 제품명 한 글자 오독 제안(세션73 U71-5)의 운영 계측.
 *
 * 무엇을 세나: 사진 제보를 «보낼 때» 제안이 있었는지, 있었다면 최종 이름이 무엇이었는지.
 *   accepted = 제안 이름으로 보냄(제안이 맞았다)
 *   kept     = OCR 이름 그대로 보냄(제안을 무시 — 오제안 후보 · eval 케이스로 옮길 것)
 *   other    = 둘 다 아닌 이름(사용자가 직접 고침 · 제안을 봤는지는 모름)
 *   none     = 제안 없음 → 키를 보내지 않는다
 *
 * ⚠ 새 이벤트 이름을 만들지 않는다 — `ALL_APP_EVENTS` 는 DB CHECK 제약과 1:1(events_db_sync).
 *   이미 화이트리스트에 있는 `source` 키를 `scan_report_submit` 에 실어 보낸다(마이그레이션 0).
 *   `scan_report_submit` 은 종전에 `source` 를 쓰지 않았으므로 의미가 섞이지 않는다.
 * ⚠ 이름 자체는 보내지 않는다(자유 입력 → PII 유입 경로). 결과 «종류»만 보낸다.
 * 비교는 서버로 보내는 정본(`normalizeProductName` — 공백 정리만)끼리 한다.
 */
import { normalizeProductName } from './photoReport'

export type NameSuggestOutcome = 'none' | 'accepted' | 'kept' | 'other'

export function nameSuggestOutcome(
  suggestion: { from: string; to: string } | null | undefined,
  finalName: unknown,
): NameSuggestOutcome {
  if (!suggestion) return 'none'
  const f = normalizeProductName(finalName)
  if (f === normalizeProductName(suggestion.to)) return 'accepted'
  if (f === normalizeProductName(suggestion.from)) return 'kept'
  return 'other'
}

export function nameSuggestSource(o: NameSuggestOutcome): string | null {
  return o === 'none' ? null : `name_suggest_${o}`
}
