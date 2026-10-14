/** 효과 측정 이벤트 연결 — M02~M07 · 정본 IP/integration/home_measure_v1/00_측정설계_평가셋_v1.md (M01 = events_db_sync) */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALLOWED_PROP_KEYS, ALL_APP_EVENTS, surfaceOf } from '../events_core'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')

describe('효과 측정 이벤트', () => {
  it('M01b 5종이 이벤트 목록에 있음', () => {
    for (const e of ['home_view', 'survey_completed', 'checkup_saved', 'checkup_goal_suggest_shown', 'checkup_goal_suggest_click'])
      expect(ALL_APP_EVENTS as readonly string[]).toContain(e)
  })
  it('M02 새 props 키 0 (22개 그대로)', () => { expect(ALLOWED_PROP_KEYS.size).toBe(22) })
  it('M03 surface 매핑', () => {
    expect(surfaceOf('survey_completed')).toBe('survey')
    expect(surfaceOf('checkup_saved')).toBe('checkup')
    expect(surfaceOf('checkup_goal_suggest_click')).toBe('checkup')
    expect(surfaceOf('home_view')).toBe('home')
    expect(surfaceOf('meal_saved')).toBe('meal')
    expect(surfaceOf('scan_saved')).toBe('scan')
  })
  it('M04 홈 방문은 pending 이 아닐 때만, 모드 변화 시 1회', () => {
    const h = read('../../pages/Home.tsx')
    expect(h).toContain("if (mode !== 'pending') track('home_view', { home_mode: mode })")
    expect(h).toMatch(/track\('home_view'[^\n]*\n\s*\}, \[mode\]\)/)
  })
  it('M05 설문 성공 경로 2곳만', () => {
    const a = read('../../App.tsx')
    expect(a.match(/track\('survey_completed'\)/g)?.length).toBe(2)
    const catchBlock = a.slice(a.indexOf("} catch (e: any) {", a.indexOf('const submitSurvey')), a.indexOf('}, [answers, loggedIn, consent])'))
    expect(catchBlock).not.toContain('survey_completed')
  })
  it('M06 검진 저장 성공 뒤에만', () => {
    const b = read('../../components/checkup/BiomarkerForm.tsx')
    const iErr = b.indexOf('if (saveResult.error)'), iTrack = b.indexOf('track("checkup_saved")')
    expect(iErr).toBeGreaterThan(0); expect(iTrack).toBeGreaterThan(iErr)
    expect(b.match(/track\("checkup_saved"\)/g)?.length).toBe(1)
  })
  it('M07 제안 노출 1회(ref) · 클릭은 저장 성공만', () => {
    const w = read('../../components/checkup/WeightGoalSuggest.tsx')
    expect(w).toContain("if (visible && !shownSent.current) { shownSent.current = true; track('checkup_goal_suggest_shown') }")
    expect(w).toContain("if (ok) track('checkup_goal_suggest_click')")
  })
})
