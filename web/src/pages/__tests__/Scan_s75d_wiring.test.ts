/**
 * ★ 세션75d — 제품 화면 «전체 판독 고지» 배선 (제이 결정 10-04 · 「전체 고지 1개 + 알레르기 1줄」).
 *   ⚠ Scan.tsx 는 렌더 테스트가 어려워 «소스 배선» 검사를 쓴다(Scan_preview_wiring 과 같은 방식).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(HERE, '../Scan.tsx'), 'utf8')

describe('Scan — 세션75d 전체 판독 고지', () => {
  it('제품 결과 화면: 고지가 알레르기 카드보다 «먼저», 제품 정보(data_source)로 갈래를 고른다', () => {
    const i = src.indexOf('data-testid="reading-notice"')
    const j = src.indexOf('<AllergenCard result={result} />')
    expect(i).toBeGreaterThan(0)
    expect(j).toBeGreaterThan(i)
    expect(src.slice(i, j)).toContain('readingNotice(result.product)')
  })
})
