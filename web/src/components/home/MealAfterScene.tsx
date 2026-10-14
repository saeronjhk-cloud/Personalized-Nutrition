/**
 * 홈 v2 2단계 — «후» 장면: 히어로 밥상에 한 가지를 더하면 빈 칸이 채워지는 모습
 * 모든 글자는 mealDemoAfter() 엔진 결과 조립(음식명·규칙 하드코딩 0, 원칙5) · 평가 home_redesign_v2_eval_v1.md §5 V14~V17
 */
import { mealDemoAfter } from '../../domain/home/meal_demo'
import { HERO_MEAL_AFTER_IMG } from './HeroScene'

export const MEDICAL_NOTICE = '본 서비스는 의학적 진단을 대체하지 않습니다. 질환이 있으신 분은 전문의와 상담하세요.'

export default function MealAfterScene() {
  const d = mealDemoAfter()
  const added = new Set(d.added)
  return (
    <section className="hv-after" aria-labelledby="hv-after-title">
      <div className="hv-after__inner">
        <div className="hv-after__text">
          <h2 id="hv-after-title" className="hv-after__title">한 가지를 더하면,<br />빈 칸이 채워집니다</h2>
          <p className="hv-after__lead">
            {d.added.join(', ')} 한 접시로 {d.filled.join(', ')} 칸이 채워졌어요.
            밥상 전체를 바꾸라고 하지 않고, 지금 밥상에서 다음 한 가지만 알려 드려요.
          </p>
          <ul className="hv-after__checks" aria-label="끼니 확인">
            {d.checks.map((c) => (
              <li key={c.label} className={c.ok ? 'is-ok' : 'is-missing'}>
                <span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {c.label}{c.ok ? '' : ' 비어 있음'}
              </li>
            ))}
          </ul>
        </div>
        <figure className="hv-after__figure">
          <div className="hero-scene__photo">
            <img
              src={HERO_MEAL_AFTER_IMG.src}
              width={HERO_MEAL_AFTER_IMG.width}
              height={HERO_MEAL_AFTER_IMG.height}
              alt={`예시 밥상에 한 가지를 더한 모습 — ${d.foods.map((f) => f.name).join(', ')}`}
              loading="lazy"
              decoding="async"
            />
            <span className="hero-scene__tag">예시</span>
            <ul className="hero-scene__chips hv-after__chips" aria-label="끼니 역할">
              {d.foods.map((f) => (
                <li key={f.name} className={`hero-scene__chip hv-after__chip${added.has(f.name) ? ' hv-after__chip--added' : ''}`}>
                  <span className="hero-scene__chip-role">{f.roleLabel}</span>
                  <span className="hero-scene__chip-name">{f.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </figure>
      </div>
      <p className="hv-notice">{MEDICAL_NOTICE}</p>
    </section>
  )
}
