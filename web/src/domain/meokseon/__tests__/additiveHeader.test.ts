// ★ 세션80(190 §10-1) — 첨가물 카드 머리 문구. 정답(구현 전 고정): backends/먹선/IP/eval_additive_header_v1/cases_v1.json = fixtures/additive_header_v1.json
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAdditiveList, describeAdditiveHeader, derivedInHeader, describeDerivedAdditiveCount, additiveEmptyNote, ADDITIVE_EMPTY_NONE, ADDITIVE_EMPTY_CHECKED } from '../additives'

const HERE = dirname(fileURLToPath(import.meta.url))
const set = JSON.parse(readFileSync(resolve(HERE, 'fixtures/additive_header_v1.json'), 'utf8')) as {
  cases: Array<{ id: string; summary?: Record<string, unknown>; expect?: { header: string; header_not_contains?: string[]; derived_subtitle: string | null; sibling_note?: boolean; unlisted?: number; empty_note?: string | null } }>
  wording: { empty_none: string; empty_checked: string }
}
const code = (rel: string) => readFileSync(resolve(HERE, rel), 'utf8')

describe('eval_additive_header_v1', () => {
  const runnable = set.cases.filter((c) => c.summary && c.expect)
  it('케이스 13건(H01~H11 · H13·H14 — v1.1)', () => { expect(runnable.length).toBe(13) })
  it('빈 상태 문구 = 정답 wording(v1.1)', () => { expect(ADDITIVE_EMPTY_NONE).toBe(set.wording.empty_none); expect(ADDITIVE_EMPTY_CHECKED).toBe(set.wording.empty_checked) })
  for (const c of runnable) {
    it(c.id, () => {
      const v = buildAdditiveList(c.summary as never)
      const e = c.expect!
      const header = describeAdditiveHeader(v)
      expect(header).toBe(e.header)
      for (const bad of e.header_not_contains ?? []) expect(header).not.toContain(bad)
      const sub = v.derived && !derivedInHeader(v) ? describeDerivedAdditiveCount(v.derived.items.length) : null
      expect(sub).toBe(e.derived_subtitle)
      if (e.sibling_note) expect(v.derived?.source).toBe('sibling')
      if (typeof e.unlisted === 'number') expect(v.unlisted).toBe(e.unlisted)
      // ★ 세션82 v1.1 R3a·R3b·R6 — 빈 상태 본문
      expect(additiveEmptyNote(v)).toBe(e.empty_note ?? null)
      // H12 — 단위 «종» 금지
      expect(header).not.toContain('종')
      if (sub) expect(sub).not.toContain('종')
    })
  }
})

describe('화면 배선', () => {
  it('상품 화면 머리가 describeAdditiveHeader 를 쓴다', () => {
    expect(code('../../../pages/Scan.tsx')).toMatch(/describeAdditiveHeader\(additiveView\)/)
  })
  it('★ v1.1 — 빈 상태 본문은 additiveEmptyNote 로(문구 직접 적지 않음)', () => {
    const scan = code('../../../pages/Scan.tsx')
    expect(scan).toMatch(/additiveEmptyNote\(additiveView\)/)
    expect(scan).not.toContain('>등록된 첨가물 정보가 없어요.<')
  })
  it('AdditiveList 소제목은 derivedInHeader 로 가리고 «종» 단위를 쓰지 않는다', () => {
    const s = code('../../../components/AdditiveList.tsx')
    expect(s).toMatch(/!derivedInHeader\(view\)/)
    expect(s).not.toMatch(/items\.length\}종/)
  })
})
