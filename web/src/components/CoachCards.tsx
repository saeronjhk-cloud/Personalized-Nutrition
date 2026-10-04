/**
 * 서박사 코칭 카드 묶음 — v1 목표 코칭 → P1 끼니 문법 (켜진 것만, 각 카드는 판정 없으면 스스로 숨김)
 * 쓰는 곳: /meal 첫 화면 맨 위 · 식사 저장 직후(저장 버튼 자리) · 재방문 홈 «오늘의 한 가지»
 * 평가: IP/integration/coach_card_placement_eval_v1.md (M1~M6) · 새 판정 0
 */
import { GOAL_COACHING_ENABLED, MEAL_GRAMMAR_ENABLED } from '../lib/flags'
import GoalCoachingCard from './GoalCoachingCard'
import MealGrammarCard from './MealGrammarCard'

export default function CoachCards() {
  return (
    <>
      {GOAL_COACHING_ENABLED && <GoalCoachingCard />}
      {MEAL_GRAMMAR_ENABLED && <MealGrammarCard />}
    </>
  )
}
