import { useEffect, useState } from 'react'
import { loadMealGrammarInput } from '../lib/mealGrammar'
import { mealGrammarCoaching, todayCoachNotice, brothCard, type BrothCard, type CoachNotice, type MealGrammarResult } from '../domain/coaching/meal_grammar'
import { threeDayReview, type ThreeDayReview } from '../domain/coaching/three_day_review'
import { coachCardId, grammarShownProps } from '../domain/coaching/coach_telemetry'
import { trackCoachShown, trackCoachWhyOpen } from '../lib/coachTelemetry'
import { grammarPose } from '../domain/coaching/coach_pose'
import CoachAvatar from './CoachAvatar'

/**
 * /meal «오늘의 밥상 코칭» (한식 끼니 문법 P1 — G-PRO·G-VEG·G-AM + 사진 검증 루프)
 * - 판정·문구는 mealGrammarCoaching() 한 곳. 여기서 음식 이름을 해석하거나 문구를 만들지 않는다(W2).
 * - 활성 카드 1장 + «유지 중» 1줄. 둘 다 없으면 «판정 대상 없음» 안내 1줄(todayCoachNotice, 오늘 판정 가능 끼니 0일 때만) — 그것도 없으면 아무것도 안 보인다.
 *   안내 평가 IP/integration/coach_notice_eval_v1.md N01~N16·W1
 * - «3일 돌아보기» 한 줄(threeDayReview — 제안 뒤 실제 기록으로 사실 확인, 평가 IP/integration/three_day_review_v1 T01~T15). 카드가 없어도 단독으로 보인다.
 * - 국물 카드(brothCard — 서박사 D6·E5, IP/integration/broth_card_v1 B01~B12): 활성 카드가 없는 날 그 자리에. 노출 이벤트 v1 없음.
 * - 노출은 MEAL_GRAMMAR_ENABLED(기본 OFF) — Meal.tsx 에서 게이트.
 * 설계 IP/integration/meal_grammar_p1_design_v1.md §7
 */
export default function MealGrammarCard() {
  const [res, setRes] = useState<MealGrammarResult | null>(null)
  const [notice, setNotice] = useState<CoachNotice | null>(null)
  const [review, setReview] = useState<ThreeDayReview | null>(null)
  const [broth, setBroth] = useState<BrothCard | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const input = await loadMealGrammarInput()
        if (!alive || !input) return
        const r = mealGrammarCoaching(input)
        setRes(r)
        setNotice(todayCoachNotice(input))
        setReview(threeDayReview(input, r.active?.rule ?? null))
        // 국물 카드(서박사 D6·E5)는 P1 활성 카드가 없는 날에만 — 하루 카드 1장
        setBroth(r.active ? null : brothCard(input))
      } catch (e) {
        console.error('[MealGrammarCard] load failed:', (e as Error).message)
      }
    })()
    return () => { alive = false }
  }, [])

  // 노출 계측(같은 날·같은 카드 1회) — coach_card_telemetry_eval_v1
  const activeRule = res?.active?.rule ?? null
  useEffect(() => {
    if (activeRule) trackCoachShown(grammarShownProps({ rule: activeRule }))
  }, [activeRule])

  if (!res) return null
  const reviewLine = review && (
    <p data-testid="three-day-review" style={{ margin: 'var(--space-2) 0 0', fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
      ✨ {review.text}
    </p>
  )
  const brothBlock = broth && (
    <div data-testid="broth-card">
      <p style={{ margin: 'var(--space-2) 0', fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{broth.text}</p>
      <details style={{ marginTop: 'var(--space-1)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <summary style={{ cursor: 'pointer' }}>왜 이 카드?</summary>
        {broth.why}
      </details>
    </div>
  )
  if (!res.active && !res.maintenance) {
    // 국물 카드가 있으면 아래 본 카드로(안내 줄은 판정 가능 끼니가 0일 때만 뜨므로 국물 카드와 겹치지 않음)
    if (broth) return renderMain()
    if (!notice && !review) return null
    return (
      <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }} data-testid="coach-standalone">
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>🍚 오늘의 밥상 코칭</div>
        {reviewLine}
        {notice && <p data-testid="coach-notice" style={{ margin: 'var(--space-2) 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{notice.text}</p>}
      </div>
    )
  }
  return renderMain()

  function renderMain() {
  if (!res) return null
  const a = res.active
  const pose = grammarPose(res) ?? (broth ? 'c2_advice' : null)

  return (
    <div className="survey-card" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }} data-testid="meal-grammar-card">
      {pose && <CoachAvatar pose={pose} size={56} />}
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>🍚 오늘의 밥상 코칭</div>
      {a && (
        <>
          <p style={{ margin: 'var(--space-2) 0', fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{a.text}</p>
          {a.evidence_text && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{a.evidence_text}</div>
          )}
          <details style={{ marginTop: 'var(--space-1)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}
            onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) trackCoachWhyOpen(coachCardId(a.rule)) }}>
            <summary style={{ cursor: 'pointer' }}>왜 이 카드?</summary>
            {a.why}
          </details>
        </>
      )}
      {!a && brothBlock}
      {reviewLine}
      {res.maintenance && (
        <div style={{ marginTop: 'var(--space-2)', fontSize: 13, color: 'var(--text-secondary)' }}>✓ {res.maintenance.text}</div>
      )}
      </div>
    </div>
  )
  }
}
