// ★ 세션80(190 §10-1) — 첨가물 카드 머리 문구. 정답(구현 전 고정): backends/먹선/IP/eval_additive_header_v1/cases_v1.json = fixtures/additive_header_v1.json
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAdditiveList, describeAdditiveHeader, derivedInHeader, describeDerivedAdditiveCount } from '../additives'

const HERE = dirname(fileURLToPath(import.meta.url))
const set = JSON.parse(readFileSync(resolve(HERE, 'fixtures/additive_header_v1.json'), 'utf8')) as {
  cases: Array<{ id: string; summary?: Record<string, unknown>; expect?: { header: string; header_not_contains?: string[]; derived_subtitle: string | null; sibling_note?: boolean; unlisted?: number } }>
}
const code = (rel: string) => readFileSync(resolve(HERE, rel), 'utf8')

describe('eval_additive_header_v1', () => {
  const runnable = set.cases.filter((c) => c.summary && c.expect)
  it('케이스 11건(H01~H11)', () => { expect(runnable.length).toBe(11) })
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
  it('AdditiveList 소제목은 derivedInHeader 로 가리고 «종» 단위를 쓰지 않는다', () => {
    const s = code('../../../components/AdditiveList.tsx')
    expect(s).toMatch(/!derivedInHeader\(view\)/)
    expect(s).not.toMatch(/items\.length\}종/)
  })
})
