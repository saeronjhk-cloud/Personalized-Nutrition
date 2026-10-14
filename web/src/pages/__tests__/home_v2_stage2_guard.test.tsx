/** 홈 v2 2단계 — V14~V23 · 평가 IP/integration/home_redesign_v2_eval_v1.md §5 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import MealAfterScene, { MEDICAL_NOTICE } from '../../components/home/MealAfterScene'
import { HERO_MEAL_AFTER_IMG } from '../../components/home/HeroScene'
import { mealDemo, mealDemoAfter, DEMO_ADD_FOOD } from '../../domain/home/meal_demo'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')
const home = read('../Home.tsx')
const after = read('../../components/home/MealAfterScene.tsx')
const css = read('../../styles/global.css')
const visitor = home.slice(home.indexOf('function VisitorHome'), home.indexOf('export default function Home'))
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('홈 v2 2단계', () => {
  it('V14 이모지 데모 → «후» 장면 1회, 히어로 뒤·Journey 앞, 재방문 홈엔 없음', () => {
    expect(home).not.toContain('<MealDemo')
    expect(home.match(/<MealAfterScene \/>/g)?.length).toBe(1)
    const iHero = visitor.indexOf('</section>'), iAfter = visitor.indexOf('<MealAfterScene />'), iJ = visitor.indexOf('<Journey />')
    expect(iAfter).toBeGreaterThan(iHero); expect(iAfter).toBeLessThan(iJ)
    const r = home.slice(home.indexOf("mode === 'returning'"), home.indexOf('<VisitorHome mode'))
    expect(r).not.toContain('MealAfterScene')
  })
  it('V15 mealDemoAfter = 같은 엔진 재판정 — 음식 5 · 모두 ok · 더한 것 1 · 채운 칸 = 전 장면 빈 칸', () => {
    const b = mealDemo(), a = mealDemoAfter()
    expect(a.foods.length).toBe(b.foods.length + 1)
    expect(a.checks.every((c) => c.ok)).toBe(true)
    expect(a.added).toEqual([DEMO_ADD_FOOD.name])
    expect(a.filled).toEqual(b.checks.filter((c) => !c.ok).map((c) => c.label))
    expect(a.foods.find((f) => f.name === DEMO_ADD_FOOD.name)?.roleLabel).toBe('단백질 반찬')
  })
  it('V16 «후» 장면 = 엔진 결과만 · 하드코딩 0 · 예시 · 칩 5 · 빈 칸 0 · 더한 칩 1', () => {
    expect(after).toContain('mealDemoAfter()')
    expect(strip(after)).not.toMatch(/잡곡밥|미역국|배추김치|시금치나물|계란말이|달걀|두부|단백질 반찬/)
    const h = renderToStaticMarkup(<MealAfterScene />)
    const a = mealDemoAfter()
    expect(h).toContain('예시')
    expect(h.match(/class="hero-scene__chip hv-after__chip/g)?.length).toBe(5)
    expect(h).not.toContain('hero-scene__chip--empty')
    expect(h.match(/hv-after__chip--added/g)?.length).toBe(1)
    for (const f of a.foods) expect(h).toContain(f.name)
    expect(h).toContain(`width="${HERO_MEAL_AFTER_IMG.width}"`)
    expect(h).toMatch(/alt="예시 밥상에 한 가지를 더한 모습 — /)
  })
  it('V17 의학 고지 상시 2곳 · FAQ 에서 진단 질문 제거', () => {
    expect(MEDICAL_NOTICE).toBe('본 서비스는 의학적 진단을 대체하지 않습니다. 질환이 있으신 분은 전문의와 상담하세요.')
    expect(after).toContain('{MEDICAL_NOTICE}')
    expect(visitor).toContain('{MEDICAL_NOTICE}')
    expect(home).not.toContain('의학적 진단을 대체할 수 있나요?')
  })
  it('V18 하나의 흐름 = 세로 타임라인 · 링크 현행', () => {
    expect(home).toContain('<ol className="hv-timeline">')
    expect(home).not.toContain('journey-grid')
    for (const to of ["to: '/scan'", "to: '/meal'", "'/dashboard' : '/survey'", "to: '/recommend?entry=home'"]) expect(home).toContain(to)
  })
  it('V19 전문가 성함·이력 현행 그대로 · 큰 프로필 1명', () => {
    for (const t of ['김재환', '서형주', '장은재', '식품영양학 박사 · 특허 14건 · 2019 대통령 표창', '고려대 교수 역임 · 일본 RIKEN 연구원 · 수면과학 전문', '동덕여대 교수 역임 · 비만연구센터장 · 임상영양 전문']) expect(home).toContain(t)
    expect(home.match(/className="hv-experts__photo"/g)?.length).toBe(1)
  })
  it('V20 FAQ 2개', () => {
    expect(visitor.match(/<FaqItem /g)?.length).toBe(2)
    expect(visitor).toContain('q="정말 무료인가요?"')
    expect(visitor).toContain('q="내 개인 정보가 저장되나요?"')
  })
  it('V21 알약 스톡 없음 · 마지막 CTA = «후» 사진', () => {
    expect(visitor).not.toContain('/supp-')
    const fin = visitor.slice(visitor.indexOf('className="hv-final"'))
    expect(fin).toContain('HERO_MEAL_AFTER_IMG.src')
    expect(fin).toContain('<StartChooser mode={mode} cta="final" />')
  })
  it('V22 방문자 홈에 섹션 머리 작은 라벨 없음', () => {
    expect(visitor).not.toContain('section-category')
  })
  it('V23 2단계 CSS 글자색은 토큰만 · 새 애니메이션 없음', () => {
    const block = css.slice(css.indexOf('홈 v2 2단계 (10-14)'))
    const colors = [...block.matchAll(/(?<![-\w])color:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(colors.length).toBeGreaterThan(5)
    for (const c of colors) expect(c).toMatch(/^var\(--hv-/)
    expect(block).not.toMatch(/@keyframes|animation:(?!\s*none)/)
  })
})
