/**
 * 검진 BMI «참고범위보다 높음» → 체중관리 목표 «제안»(서박사 회신 v2 ④) — 목표를 대신 켜지 않고, 누를 때만 저장
 * 판정 shouldSuggestWeightGoal()(순수) · 저장은 GoalsCard 와 같은 경로(validateGoalsForSave → saveUserGoals)
 * 평가 IP/integration/checkup_coaching_link_eval_v1.md K12~K15
 */
import { useEffect, useRef, useState } from 'react'
import { track } from '../../lib/events'
import { supabase } from '../../lib/supabase'
import { loadEffectiveGoals, saveUserGoals, fetchLatestBody } from '../../lib/userGoals'
import { validateGoalsForSave, bmiFromAnswers } from '../../domain/goals/goals'
import type { CategoryResult } from '../../domain/checkup/engine'
import { shouldSuggestWeightGoal, WEIGHT_GOAL_SUGGEST_TEXT, WEIGHT_GOAL_SUGGEST_BUTTON, WEIGHT_GOAL_SUGGEST_DONE } from '../../domain/checkup/coaching_hints'
import { MEAL_ENABLED } from '../../lib/flags'

export default function WeightGoalSuggest({ results }: { results: CategoryResult[] }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [goals, setGoals] = useState<string[] | null>(null)
  const [bmi, setBmi] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  useEffect(() => {
    if (!MEAL_ENABLED) return
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !alive) return
        const [g, body] = await Promise.all([loadEffectiveGoals(user.id), fetchLatestBody(user.id)])
        if (!alive) return
        setUserId(user.id); setGoals(g.goals); setBmi(bmiFromAnswers(body))
      } catch { /* 제안은 선택 기능 — 실패하면 보이지 않음 */ }
    })()
    return () => { alive = false }
  }, [])

  const visible = MEAL_ENABLED && !!userId && state !== 'done' && shouldSuggestWeightGoal(results, goals)
  // 효과 측정 M07 — 제안이 실제로 그려질 때 1회
  const shownSent = useRef(false)
  useEffect(() => {
    if (visible && !shownSent.current) { shownSent.current = true; track('checkup_goal_suggest_shown') }
  }, [visible])

  if (!MEAL_ENABLED || !userId) return null
  if (state === 'done') {
    return <p className="checkup-weight-suggest checkup-weight-suggest--done" data-testid="weight-goal-suggest-done">{WEIGHT_GOAL_SUGGEST_DONE}</p>
  }
  if (!shouldSuggestWeightGoal(results, goals)) return null

  async function turnOn() {
    if (!userId || goals === null) return
    setState('saving')
    const v = validateGoalsForSave([...goals, '체중관리'], bmi)
    const r = await saveUserGoals(userId, v.goals)
    const ok = r.ok && v.goals.includes('체중관리')
    if (ok) track('checkup_goal_suggest_click') // M07 — 저장 성공만
    setState(ok ? 'done' : 'error')
  }

  return (
    <div className="checkup-weight-suggest" data-testid="weight-goal-suggest">
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{WEIGHT_GOAL_SUGGEST_TEXT}</p>
      <button type="button" className="btn btn-secondary" style={{ marginTop: 'var(--space-2)', fontSize: 15 }} disabled={state === 'saving'} onClick={turnOn}>
        {WEIGHT_GOAL_SUGGEST_BUTTON}
      </button>
      {state === 'error' && <p style={{ margin: 'var(--space-2) 0 0', fontSize: 13, color: 'var(--danger)' }}>저장하지 못했어요. 잠시 후 다시 눌러 주세요.</p>}
    </div>
  )
}
