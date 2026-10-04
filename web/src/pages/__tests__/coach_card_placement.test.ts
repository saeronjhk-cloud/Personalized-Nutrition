/** 코칭 카드 위치 — IP/integration/coach_card_placement_eval_v1.md M1~M6 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const meal = readFileSync(resolve(__dirname, '../Meal.tsx'), 'utf-8')
const coach = readFileSync(resolve(__dirname, '../../components/CoachCards.tsx'), 'utf-8')
const home = readFileSync(resolve(__dirname, '../../components/home/ReturningHome.tsx'), 'utf-8')

describe('코칭 카드 위치', () => {
  it('M1 /meal 첫 화면: 코칭 카드가 목표 카드(GoalsCard)보다 먼저', () => {
    const a = meal.indexOf('{!result && <CoachCards />}')
    const b = meal.indexOf('{!result && <GoalsCard />}')
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(b)
  })
  it('M2 저장 직후: afterSave(저장 버튼 자리) 안에서 «먹은 양»보다 먼저 카드', () => {
    const s = meal.slice(meal.indexOf('afterSave={'))
    expect(s.indexOf('<CoachCards key={savedId} />')).toBeGreaterThan(0)
    expect(s.indexOf('<CoachCards key={savedId} />')).toBeLessThan(s.indexOf('<AfterSaveLeftover'))
  })
  it('M3 저장마다 새로 읽기(key=savedId) · 흐름 v2 꺼져도 저장 뒤 카드', () => {
    expect(meal).toContain('<CoachCards key={savedId} />')
    expect(meal).toContain("{saved && !MEAL_FLOW_V2_ENABLED && <CoachCards key={savedId ?? 'saved'} />}")
  })
  it('M4 카드 묶음 순서 v1 → P1 · 플래그 게이트', () => {
    expect(coach.indexOf('GOAL_COACHING_ENABLED && <GoalCoachingCard />')).toBeLessThan(coach.indexOf('MEAL_GRAMMAR_ENABLED && <MealGrammarCard />'))
  })
  it('M5 재방문 홈도 같은 묶음', () => {
    expect(home).toContain('<CoachCards />')
  })
  it('M6 새 판정 없음(묶음은 렌더만)', () => {
    expect(coach).not.toMatch(/goalMealCoaching\(|mealGrammarCoaching\(|resolveRoles/)
  })
})
