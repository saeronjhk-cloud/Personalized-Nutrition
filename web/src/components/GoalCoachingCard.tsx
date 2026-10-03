import { useEffect, useState } from 'react'
import { loadGoalCoachingInput } from '../lib/goalCoaching'
import { goalMealCoaching, SLOT_LABEL, type ProteinCard } from '../domain/coaching/goal_meal_coaching'
import { v1ShownProps } from '../domain/coaching/coach_telemetry'
import { trackCoachShown } from '../lib/coachTelemetry'
import { v1Pose } from '../domain/coaching/coach_pose'
import CoachAvatar from './CoachAvatar'

/**
 * /meal «오늘의 식사 코칭» (목표 기반 식사 코칭 v1 — 근육증가 → 끼니 단백질 더하기)
 * - 판정은 goalMealCoaching() 한 곳. 여기서 숫자·문구를 새로 만들지 않는다.
 * - 하루 카드 1장, 안에 끼니별 섭취/목표(IP/155 Q1). 부족 없으면 아무것도 안 보인다.
 * - 노출은 GOAL_COACHING_ENABLED(기본 OFF) — Meal.tsx 에서 게이트.
 */
export default function GoalCoachingCard() {
  const [card, setCard] = useState<ProteinCard | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const input = await loadGoalCoachingInput()
        if (!alive || !input) return
        setCard(goalMealCoaching(input).cards[0] ?? null)
      } catch (e) {
        console.error('[GoalCoachingCard] load failed:', (e as Error).message)
      }
    })()
    return () => { alive = false }
  }, [])

  // 노출 계측(같은 날 1회) — coach_card_telemetry_eval_v1
  const level = card?.level ?? null
  useEffect(() => {
    if (level) trackCoachShown(v1ShownProps({ level }))
  }, [level])

  if (!card) return null

  return (
    <div className="survey-card" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }} data-testid="goal-coaching-card">
      <CoachAvatar pose={v1Pose(card)} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>🥚 오늘의 식사 코칭</div>
      <p style={{ margin: 'var(--space-2) 0', fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{card.text}</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {card.meals.map((m) => (
          <li key={m.slot}>{SLOT_LABEL[m.slot]} 단백질 {m.protein_g}g · 끼니 목표 {m.target_g}g</li>
        ))}
      </ul>
      <div style={{ marginTop: 'var(--space-2)', fontSize: 12, color: 'var(--text-muted)' }}>
        내 건강 목표를 기준으로 오늘 기록한 끼니만 봐요.
      </div>
      </div>
    </div>
  )
}
