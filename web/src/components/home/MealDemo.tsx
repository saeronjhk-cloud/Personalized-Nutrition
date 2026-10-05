import { useEffect, useRef, useState } from 'react'
import { mealDemo, DEMO_TIMELINE_MS } from '../../domain/home/meal_demo'

/**
 * 홈 P1 — 10초 밥상 데모 (방문자 홈 Hero 아래)
 * 내용은 mealDemo()(실제 엔진 계산) 결과만 그린다 — 여기서 음식 역할·문구를 만들지 않는다(D05).
 * 화면에 들어오면 4단계 재생(≤10초) · «다시 보기» · reduced-motion 이면 마지막 상태 바로.
 * 평가 IP/integration/home_demo_eval_v1.md D01~D11
 */
const DEMO = mealDemo()
const STEPS = [DEMO_TIMELINE_MS.foods, DEMO_TIMELINE_MS.roles, DEMO_TIMELINE_MS.checks, DEMO_TIMELINE_MS.card]

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export default function MealDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState(0) // 0 = 대기, 1~4 = 단계
  const [run, setRun] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { setStage(4); return }
    let timers: number[] = []
    const play = () => {
      timers.forEach(clearTimeout)
      setStage(0)
      timers = STEPS.map((ms, i) => window.setTimeout(() => setStage(i + 1), ms + 200))
    }
    if (run > 0) { play(); return () => timers.forEach(clearTimeout) }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { play(); io.disconnect() }
    }, { threshold: 0.3 })
    io.observe(el)
    return () => { io.disconnect(); timers.forEach(clearTimeout) }
  }, [run])

  return (
    <section className="content-section meal-demo-section">
      <div className="section-category">사진 한 장이면</div>
      <h2 className="section-title" style={{ textAlign: 'center' }}>밥상을 이렇게 읽어요</h2>
      <div ref={ref} className={`meal-demo meal-demo--s${stage}`} aria-live="polite">
        <div className="meal-demo__tag">예시 · 점심 밥상</div>
        <ul className="meal-demo__foods">
          {DEMO.foods.map((f) => (
            <li key={f.name} className="meal-demo__food">
              <span className="meal-demo__emoji" aria-hidden="true">{f.emoji}</span>
              <span className="meal-demo__name">{f.name}</span>
              <span className="meal-demo__role">{f.roleLabel}</span>
            </li>
          ))}
        </ul>
        <ul className="meal-demo__checks">
          {DEMO.checks.map((c) => (
            <li key={c.label} className={c.ok ? 'is-ok' : 'is-missing'}>
              {c.ok ? '✓' : '○'} {c.label}{c.ok ? '' : ' 없음'}
            </li>
          ))}
        </ul>
        {DEMO.card && (
          <div className="meal-demo__card">
            <div className="meal-demo__card-title">🍚 오늘의 밥상 코칭</div>
            <p>{DEMO.card.text}</p>
          </div>
        )}
        <button type="button" className="meal-demo__replay" onClick={() => setRun((n) => n + 1)}>다시 보기 ↻</button>
      </div>
      <p className="meal-demo__note">숫자 대신, 끼니에 무엇이 있고 무엇이 빠졌는지 알려 드려요.</p>
    </section>
  )
}
