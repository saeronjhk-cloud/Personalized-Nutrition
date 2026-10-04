/**
 * ★ 세션75b — 운영 화면 실물 확인(10-04 · 호두정과 8801133013460)에서 나온 2건.
 *   ① 영양성분 표에 «기준»이 없었다 — 표는 1회 제공량(10g) 값(66.9kcal)인데 바로 아래 %는 «총 내용량 80g 기준»이라
 *      읽는 사람이 섞어 읽는다. 표 머리에 서버 `nutrition.basis` 기준을 붙인다(basisPhrase 재사용 · 지어내지 않음).
 *   ② 「내 기준으로 보기」 사유 뒤 조사가 «이라» 고정 → «혈당 관리 목표이라». withIra 로.
 * ⚠ Scan.tsx 는 렌더 테스트가 어려워 «소스 배선» 검사를 쓴다(Scan_preview_wiring 과 같은 방식).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(HERE, '../Scan.tsx'), 'utf8')

describe('Scan — 세션75b 배선', () => {
  it('① 영양성분 표 머리에 기준 문구(nutrition.basis · basisPhrase)', () => {
    const i = src.indexOf('>영양성분</h3>')
    expect(i).toBeGreaterThan(0)
    const head = src.slice(i, src.indexOf('<table', i))
    expect(head).toContain('data-testid="nutri-basis"')
    expect(head).toMatch(/basisPhrase\(result\.nutrition\.basis/)
  })
  it('② 사유 조사는 withIra 로 (고정 «이라» 금지)', () => {
    expect(src).toContain('withIra(f.reason)')
    expect(src).not.toContain('{f.reason}이라')
  })
})
