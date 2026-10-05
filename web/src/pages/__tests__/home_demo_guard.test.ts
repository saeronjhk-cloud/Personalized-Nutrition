/** 홈 P1 10초 밥상 데모 — 화면·배치 가드 D05~D09·D11 · 정본 IP/integration/home_demo_eval_v1.md */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const home = readFileSync(resolve(__dirname, '../Home.tsx'), 'utf-8')
const demo = readFileSync(resolve(__dirname, '../../components/home/MealDemo.tsx'), 'utf-8')
const css = readFileSync(resolve(__dirname, '../../styles/global.css'), 'utf-8')

describe('홈 밥상 데모 가드', () => {
  it('D05 컴포넌트는 mealDemo() 결과만', () => {
    expect(demo).toContain('mealDemo()')
    expect(demo).not.toMatch(/resolveRoles|GRAMMAR_TEMPLATES|mealGrammarCoaching|단백질 반찬이 없었습니다/)
  })
  it('D06 금지어 없음(컴포넌트)', () => {
    expect(demo).not.toMatch(/kcal|칼로리|점수|감량|GLP-1|보장|최초|유일/)
  })
  it('D07 «예시» 표기', () => {
    expect(demo).toContain('예시')
  })
  it('D08 reduced-motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.meal-demo/)
  })
  it('D09·D11 위치: 방문자 홈 Hero 다음·Journey 앞 1회, 게이트, StartChooser 2개 유지', () => {
    expect(home.match(/<MealDemo \/>/g)?.length).toBe(1)
    const v = home.slice(home.indexOf('function VisitorHome'))
    const iHero = v.indexOf('</section>')
    const iDemo = v.indexOf('{MEAL_ENABLED && <MealDemo />}')
    const iJourney = v.indexOf('<Journey />')
    expect(iDemo).toBeGreaterThan(iHero)
    expect(iDemo).toBeLessThan(iJourney)
    const r = home.slice(home.indexOf("mode === 'returning'"), home.indexOf('<VisitorHome mode'))
    expect(r).not.toContain('MealDemo')
    expect(home.match(/<StartChooser /g)?.length).toBe(2)
  })
})
