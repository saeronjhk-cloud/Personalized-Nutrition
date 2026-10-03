/**
 * 푸터·처리방침 문의 메일 + 내 건강 운동 모듈 제거 (2026-10-03 제이 요청)
 *  F1 개인 메일(saeronjhk@gmail.com)이 화면 소스에 없다
 *  F2 푸터와 처리방침 §8 이 같은 대외 메일(contact@saeronmedia.com)
 *  F3 내 건강(/dashboard)에 운동 모듈 카드 없음(개발 계획 없음)
 *  F4 푸터 서비스 링크가 실제 라우트(내 건강·영양제 추천·건강 변화 리포트 등)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')

describe('푸터 문의 메일 · 내 건강 모듈', () => {
  const footer = read('../Footer.tsx')
  const privacy = read('../../pages/Privacy.tsx')
  const dash = read('../../pages/Dashboard.tsx')
  it('F1 개인 메일 노출 없음', () => {
    for (const s of [footer, privacy, dash]) expect(s).not.toContain('saeronjhk@gmail.com')
  })
  it('F2 같은 대외 메일', () => {
    expect(footer).toContain("CONTACT_EMAIL = 'contact@saeronmedia.com'")
    expect(privacy).toContain('이메일: contact@saeronmedia.com')
  })
  it('F3 운동 모듈 없음', () => {
    expect(dash).not.toMatch(/title="운동"/)
    expect(dash).not.toContain('운동 중 편한 것부터')
  })
  it('F4 서비스 링크', () => {
    for (const to of ['/dashboard', '/survey', '/health-report', '/blog', '/resources']) expect(footer).toContain(`to="${to}"`)
  })
})
