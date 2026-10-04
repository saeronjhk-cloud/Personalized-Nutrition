/**
 * 홈 «나부터 시작하기» — 대표 CTA 1개 → 시작 선택(사진·설문·검진 + 보조 가공식품)
 * 판정: domain/home/home_mode.ts startOptions · 평가 IP/integration/home_redesign_v1_design.md H04~H06·H10·H15
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { track } from '../../lib/events'
import { MEAL_ENABLED, CHECKUP_ENABLED, MEOKSEON_ENABLED } from '../../lib/flags'
import { startOptions, type HomeMode } from '../../domain/home/home_mode'

export default function StartChooser({ mode, cta, label = '나부터 시작하기' }: { mode: HomeMode; cta: 'start' | 'final'; label?: string }) {
  const [open, setOpen] = useState(false)
  const { main, extra } = startOptions({ meal: MEAL_ENABLED, checkup: CHECKUP_ENABLED, meokseon: MEOKSEON_ENABLED })
  return (
    <div className="start-chooser">
      <button
        type="button"
        className="btn btn-primary hero-cta"
        aria-expanded={open}
        onClick={() => { if (!open) track('home_cta_click', { home_mode: mode, cta }); setOpen(!open) }}
      >
        {label} →
      </button>
      {open && (
        <div className="start-chooser__sheet" role="group" aria-label="어디서 시작할까요?">
          <div className="start-chooser__title">어디서 시작할까요?</div>
          {main.map((o, i) => (
            <Link key={o.id} to={o.to} className="feature-hub-card start-chooser__option"
              onClick={() => track('home_start_choice', { home_mode: mode, start_choice: o.id })}>
              <span className="start-chooser__num">{i + 1}</span>
              <div className="feature-hub-body">
                <div className="feature-hub-name">{o.title}</div>
                <div className="feature-hub-desc">{o.desc}</div>
              </div>
              <span className="feature-hub-arrow">→</span>
            </Link>
          ))}
          {extra && (
            <Link to={extra.to} className="text-link start-chooser__extra"
              onClick={() => track('home_start_choice', { home_mode: mode, start_choice: extra.id })}>
              {extra.title} →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
