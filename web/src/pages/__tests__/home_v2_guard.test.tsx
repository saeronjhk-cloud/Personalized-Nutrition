/** 홈 v2 1단계 — V01~V09 · 평가 IP/integration/home_redesign_v2_eval_v1.md */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import HeroScene, { HERO_MEAL_IMG } from '../../components/home/HeroScene'
import { mealDemo } from '../../domain/home/meal_demo'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')
const css = read('../../styles/global.css')
const home = read('../Home.tsx')
const scene = read('../../components/home/HeroScene.tsx')

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const tok = (name: string) => {
  const m = css.match(new RegExp(`--hv-${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(name)
  return m[1]
}

describe('홈 v2 1단계', () => {
  it('V01 대비 ≥ 4.5 (CSS 값으로 계산)', () => {
    const pairs: [string, string][] = [['ink', 'ivory'], ['stone', 'ivory'], ['green', 'ivory'], ['brown', 'ivory'], ['ink', 'sage'], ['brown', 'sage']]
    for (const [a, b] of pairs) expect(ratio(tok(a), tok(b))).toBeGreaterThanOrEqual(4.5)
    expect(ratio('#FFFFFF', tok('green'))).toBeGreaterThanOrEqual(4.5)
  })
  it('V02 새 토큰은 .home-v2 안에만 — :root 에 없음', () => {
    const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))
    expect(root).not.toContain('--hv-')
    expect(css).toMatch(/\.home-v2 \{\s*--hv-ink/)
    expect(home).toContain("mode === 'visitor' || mode === 'returning' ? ' home-v2' : ''")
  })
  it('V03 히어로 문구(제이 결정 ChatGPT안) · 금지어 없음', () => {
    expect(home).toContain('오늘 먹은 밥상과 영양제,<br /><span className="hero-v2__nw">겹치고 넘치는 성분을</span> <span className="hero-v2__nw">한눈에.</span>') // 대표 문구 J2(제이 10-18)
    expect(home).toContain('식사에서 놓친 점과 오늘 실천할 한 가지를 알려드려요.')
    const visible = (home + scene).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(visible).not.toMatch(/kcal|칼로리|점수|감량|GLP-1|보장|최초|유일/)
  })
  it('V04 대표 버튼 2곳 유지(H10) · 히어로 안에 /scan 링크 없음', () => {
    expect(home.match(/<StartChooser /g)?.length).toBe(2)
    const hero = home.slice(home.indexOf('<section className="hero-v2">'), home.indexOf('</section>', home.indexOf('<section className="hero-v2">')))
    expect(hero).not.toContain('/scan')
  })
  it('V05 장면 글자는 mealDemo() 엔진 결과만(하드코딩 0)', () => {
    expect(scene).toContain('mealDemo()')
    expect(scene).not.toMatch(/잡곡밥|미역국|배추김치|시금치나물|단백질 반찬이|달걀|두부/)
  })
  it('V06·V07 정적 렌더 — 칩 4개=엔진 역할 · 결과=엔진 문장 · 예시 · alt·크기·우선 로드', () => {
    const h = renderToStaticMarkup(<HeroScene />)
    const d = mealDemo()
    expect(h.match(/class="hero-scene__chip"/g)?.length).toBe(4)
    // V13 빈 칸 칩 = 엔진 checks 중 ok=false 만(이 예시 = 단백질 반찬 1개)
    const empty = d.checks.filter((c) => !c.ok)
    expect(h.match(/hero-scene__chip--empty/g)?.length).toBe(empty.length)
    expect(empty.map((c) => c.label)).toEqual(['단백질 반찬'])
    expect(h).toContain('비어 있음')
    for (const f of d.foods) { expect(h).toContain(f.roleLabel); expect(h).toContain(f.name) }
    expect(h).toContain(d.card!.text)
    expect(h).toContain('예시')
    expect(h).toContain(`width="${HERO_MEAL_IMG.width}"`)
    expect(h).toContain(`height="${HERO_MEAL_IMG.height}"`)
    expect(h).toMatch(/alt="예시 밥상 — 잡곡밥, 미역국, 배추김치, 시금치나물"/)
    expect(h).toMatch(/fetchPriority="high"|fetchpriority="high"/)
  })
  it('V08 움직임 최소화 설정이면 칩 애니메이션 없음', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.hero-scene__chip \{ animation: none; opacity: 1;/)
  })
  it('V09 명조는 .home-v2 의 h1·h2 에만', () => {
    expect(css).toContain(".home-v2 h1, .home-v2 h2 { font-family: var(--hv-font-title)")
    expect(css.match(/var\(--hv-font-title\)/g)?.length).toBe(1)
  })
})

describe('홈 v2 배치(제이 결정 P)', () => {
  it('V11 히어로 순서 = 제목 → 장면 → 버튼', () => {
    const h = readFileSync(resolve(__dirname, '../Home.tsx'), 'utf-8')
    const a = h.indexOf('className="hero-v2__title"'), b = h.indexOf('<HeroScene />'), c = h.indexOf('<StartChooser mode={mode} cta="start" />')
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a); expect(c).toBeGreaterThan(b)
    expect(h.match(/<HeroScene \/>/g)?.length).toBe(1)
  })
})
