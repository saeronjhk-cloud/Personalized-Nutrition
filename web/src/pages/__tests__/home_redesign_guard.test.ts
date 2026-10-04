/** 홈 개편 v1 P0 가드 — IP/integration/home_redesign_v1_design.md H10~H13 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const home = readFileSync(resolve(__dirname, '../Home.tsx'), 'utf-8')
const chooser = readFileSync(resolve(__dirname, '../../components/home/StartChooser.tsx'), 'utf-8')
const returning = readFileSync(resolve(__dirname, '../../components/home/ReturningHome.tsx'), 'utf-8')
const domain = readFileSync(resolve(__dirname, '../../domain/home/home_mode.ts'), 'utf-8')
const all = [home, chooser, returning, domain].join('\n')
// 주석 제외한 화면 문구만 검사
const visible = all.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('홈 개편 v1 가드', () => {
  it('H10 대표 CTA = StartChooser 2개(hero·final), 그 외 기능 CTA 버튼 없음', () => {
    expect(home.match(/<StartChooser /g)?.length).toBe(2)
    expect(home).not.toMatch(/className="btn btn-primary/)
    expect(chooser).toContain("'나부터 시작하기'")
  })
  it('H11 문구 가드 — kcal·점수·감량·GLP-1·보장·최초·유일 없음', () => {
    expect(visible).not.toMatch(/kcal|칼로리|영양점수|점수|감량|GLP-1|보장|최초|유일/)
  })
  it('H12 서박사 새 문구·이력 없음(B·C 현행 유지)', () => {
    expect(visible).not.toMatch(/판단 규칙은 서형주|스탠퍼드|상위 2%|박사님이 직접/)
  })
  it('H13 숫자 나열·카운트업 없음', () => {
    expect(home).not.toMatch(/CountUp|15개 페르소나|390\+|120\+|36가지/)
  })
  it('H14 재방문 홈 = 승인 코칭 카드 재사용(새 판정 없음)', () => {
    expect(returning).toContain('<MealGrammarCard />')
    expect(returning).toContain('<GoalCoachingCard />')
    expect(returning).toContain('todayCards(')
  })
})
