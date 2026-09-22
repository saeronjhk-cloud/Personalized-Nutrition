/**
 * 세션54 — 사진 수집 베타 패널 «배선» 가드 (Scan_allergen_wiring 과 같은 형식의 소스 검사).
 *
 * 지키는 것 셋:
 *   1. FEEDBACK_KINDS 의 key 가 151_beta_feedback_v1.sql 의 CHECK(kind in …) 와 글자까지 같다.
 *      (어긋나면 INSERT 가 CHECK 에 걸려 «조용히» 거부된다 — 150 과 같은 형태의 사고)
 *   2. /beta 라우트가 App.tsx 에 있다.
 *   3. Meal.tsx 가 BetaFeedback 을 jobId 와 함께 렌더한다 — job_id 없는 피드백은 사진과 못 잇는다.
 *
 * ⚠ 소스 문자열 검사다. 초록이라고 화면이 맞다는 뜻이 아니다 — 되돌림 방지 장치다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { FEEDBACK_KINDS, sendFeedback } from '../betaPanel'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(HERE, p), 'utf8')

describe('beta panel wiring', () => {
  it('FEEDBACK_KINDS == SQL CHECK(kind in …)', () => {
    const sql = read('../../../supabase/151_beta_feedback_v1.sql')
    const m = sql.match(/check \(kind in \(([^)]*)\)\)/)
    expect(m, 'SQL 에 kind CHECK 가 없다').toBeTruthy()
    const inSql = m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).sort()
    const inTs = FEEDBACK_KINDS.map((k) => k.key as string).sort()
    expect(inTs).toEqual(inSql)
  })

  it('/beta 라우트가 App.tsx 에 배선돼 있다', () => {
    const app = read('../../App.tsx')
    expect(app).toMatch(/<Route path="\/beta" element=\{<BetaLanding \/>\} \/>/)
  })

  it('Meal.tsx 가 BetaFeedback 을 jobId 와 함께 렌더한다', () => {
    const meal = read('../../pages/Meal.tsx')
    expect(meal).toMatch(/<BetaFeedback jobId=\{jobIdRef\.current\}/)
    expect(meal).toMatch(/jobIdRef\.current = state\.jobId/)
  })

  it('빈 메시지는 서버에 가지 않는다', async () => {
    const r = await sendFeedback({ kind: 'bug', message: '   ' })
    expect(r).toEqual({ ok: false, error: '내용을 적어 주세요.' })
  })
})
