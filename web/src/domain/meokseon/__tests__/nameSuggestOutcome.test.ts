/** ★ 세션74 U73-1 — 제품명 제안 운영 계측(노출·수락). 새 이벤트명 없이 scan_report_submit.source 로 보낸다. */
import { describe, it, expect } from 'vitest'
import { nameSuggestOutcome, nameSuggestSource } from '../nameSuggestOutcome'
import { ALLOWED_PROP_KEYS } from '../../../lib/events_core'

const S = { from: '호두정고', to: '호두정과' }

describe('nameSuggestOutcome', () => {
  it('제안 없음 → none', () => expect(nameSuggestOutcome(null, '호두정고')).toBe('none'))
  it('제안 이름으로 보냄 → accepted', () => expect(nameSuggestOutcome(S, '호두정과')).toBe('accepted'))
  it('OCR 이름 그대로 보냄 → kept(제안 무시 = 오제안 후보)', () => expect(nameSuggestOutcome(S, '호두정고')).toBe('kept'))
  it('둘 다 아닌 이름 → other(제안을 봤는지 모름)', () => expect(nameSuggestOutcome(S, '호두 강정')).toBe('other'))
  it('앞뒤 공백·연속 공백은 같은 이름', () => {
    expect(nameSuggestOutcome(S, '  호두정과 ')).toBe('accepted')
    expect(nameSuggestOutcome({ from: '순살  치킨', to: '순살 치킨' }, '순살 치킨')).toBe('accepted')
  })
  it('직접 쳐서 제안과 같은 이름이 돼도 accepted(결과 기준)', () => expect(nameSuggestOutcome(S, '호두정과')).toBe('accepted'))
})

describe('nameSuggestSource', () => {
  it('none → null(키를 보내지 않음과 같음)', () => expect(nameSuggestSource('none')).toBeNull())
  it('값은 name_suggest_ 접두 3종', () => {
    expect(nameSuggestSource('accepted')).toBe('name_suggest_accepted')
    expect(nameSuggestSource('kept')).toBe('name_suggest_kept')
    expect(nameSuggestSource('other')).toBe('name_suggest_other')
  })
  it('보내는 키 source 는 이미 화이트리스트(DB 마이그레이션 불필요)', () => expect(ALLOWED_PROP_KEYS.has('source')).toBe(true))
})
