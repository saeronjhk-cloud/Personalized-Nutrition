/** 재방문 홈 v2 — R01~R04 · 평가 IP/integration/home_redesign_v2_eval_v1.md §7 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')
const home = read('../Home.tsx')
const css = read('../../styles/global.css')
const returning = read('../../components/home/ReturningHome.tsx')
const block = css.slice(css.indexOf('재방문 홈 v2 (10-14)'))

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const tok = (n: string) => css.match(new RegExp(`--hv-${n}:\\s*(#[0-9A-Fa-f]{6})`))![1]

describe('재방문 홈 v2', () => {
  it('R01 home-v2 = 방문자·재방문, 자리 표시는 따로(먼저 return)', () => {
    expect(home).toContain("mode === 'visitor' || mode === 'returning' ? ' home-v2' : ''")
    const iPending = home.indexOf("if (mode === 'pending')"), iClass = home.indexOf("' home-v2'")
    expect(iPending).toBeGreaterThan(0); expect(iPending).toBeLessThan(iClass)
  })
  it('R02 재방문 홈 내용·판정 무변경 — H14 유지', () => {
    expect(returning).toContain('<CoachCards />')
    expect(returning).toContain('todayCards(')
    expect(returning).toContain('다음 끼니 기록하기 →')
    expect(returning).not.toContain('home-v2')
  })
  it('R03 글자·배경색은 --hv-* 토큰만 · 새 애니메이션 없음', () => {
    const vals = [...block.matchAll(/(?<![-\w])(color|background|border-color):\s*([^;]+);/g)].map((m) => m[2].trim())
    expect(vals.length).toBeGreaterThan(8)
    for (const v of vals) expect(v).toMatch(/^(var\(--hv-[a-z-]+\)|transparent)$/)
    expect(block).not.toMatch(/@keyframes|animation:/)
  })
  it('R04 대비 ≥ 4.5', () => {
    expect(ratio(tok('white'), tok('green'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(tok('green'), tok('sage'))).toBeGreaterThanOrEqual(4.5) // 기록한 끼니 칸
    expect(ratio(tok('ink'), tok('sage-soft'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(tok('stone'), tok('sage-soft'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(tok('stone'), tok('ivory'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(tok('ink'), tok('white'))).toBeGreaterThanOrEqual(4.5)
  })
})
