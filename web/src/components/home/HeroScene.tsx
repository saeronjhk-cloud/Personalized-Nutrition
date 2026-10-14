/**
 * 홈 v2 히어로 장면 — 실제 밥상 사진 + 엔진 결과(역할 칩 · 오늘 더해볼 것)
 * 모든 글자는 mealDemo() 엔진 결과(하드코딩 0, 원칙5) · 평가 IP/integration/home_redesign_v2_eval_v1.md V05~V08
 */
import { mealDemo } from '../../domain/home/meal_demo'

export const HERO_MEAL_IMG = { src: '/home/hero_meal_before.webp', width: 1168, height: 750 } as const
export const HERO_MEAL_AFTER_IMG = { src: '/home/hero_meal_after.webp', width: 1168, height: 880 } as const
/** 마지막 CTA — 밥상을 휴대폰으로 찍는 장면(CTA 행동과 일치, 같은 사진 반복 방지 · V26) */
export const HERO_MEAL_SNAP_IMG = { src: '/home/hero_meal_snap.webp', width: 1168, height: 880 } as const

export default function HeroScene() {
  const demo = mealDemo()
  return (
    <figure className="hero-scene" aria-label="예시 밥상을 읽은 결과">
      <div className="hero-scene__photo">
        <img
          src={HERO_MEAL_IMG.src}
          width={HERO_MEAL_IMG.width}
          height={HERO_MEAL_IMG.height}
          alt={`예시 밥상 — ${demo.foods.map((f) => f.name).join(', ')}`}
          fetchPriority="high"
          decoding="async"
        />
        <span className="hero-scene__tag">예시</span>
        <ul className="hero-scene__chips" aria-label="끼니 역할">
          {demo.foods.map((f, i) => (
            <li key={f.name} className="hero-scene__chip" style={{ animationDelay: `${600 + i * 350}ms` }}>
              <span className="hero-scene__chip-role">{f.roleLabel}</span>
              <span className="hero-scene__chip-name">{f.name}</span>
            </li>
          ))}
          {/* 빈 칸(외부 제안서 아이디어 2-1) — 엔진 checks 중 ok=false 만 · V13 */}
          {demo.checks.filter((c) => !c.ok).map((c, j) => (
            <li key={`empty-${c.label}`} className="hero-scene__chip hero-scene__chip--empty" style={{ animationDelay: `${600 + (demo.foods.length + j) * 350}ms` }}>
              <span className="hero-scene__chip-role">{c.label}</span>
              <span className="hero-scene__chip-name">비어 있음</span>
            </li>
          ))}
        </ul>
      </div>
      {demo.card && (
        <figcaption className="hero-scene__result">
          <span className="hero-scene__result-label">오늘 더해볼 것</span>
          <span className="hero-scene__result-text">{demo.card.text}</span>
        </figcaption>
      )}
    </figure>
  )
}
