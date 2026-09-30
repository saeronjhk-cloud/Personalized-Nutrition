/**
 * ★ 세션72d — 앱 관리자 화면(/admin) · 관리자 API 클라이언트
 *   ① 서버 응답 → 화면 상태(401 로그인 · 403 권한없음 · 그 외 불가)
 *   ② 제보 값 요약(describeProposed)
 *   ③ 배선: /admin 라우트는 있고 · 전역 메뉴(Navbar 등)에는 없다 · Account 는 서버 판정(adminWhoami)으로만 링크
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AdminApiError, gateFromError, describeProposed } from '../meokseonAdmin'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

describe('gateFromError', () => {
  it('401 → login · 403 → forbidden · 그 외 → unavailable', () => {
    expect(gateFromError(new AdminApiError(401, 'AUTH_REQUIRED', ''))).toBe('login')
    expect(gateFromError(new AdminApiError(403, 'ADMIN_FORBIDDEN', ''))).toBe('forbidden')
    expect(gateFromError(new AdminApiError(503, 'X', ''))).toBe('unavailable')
    expect(gateFromError(new Error('network'))).toBe('unavailable')
  })
})

describe('describeProposed', () => {
  it('알레르기는 등급별로 묶는다', () => {
    const l = describeProposed('allergens', { inspected: true, allergens: [
      { name: '밀', evidence_level: 'contains' }, { name: '대두', evidence_level: 'contains' }, { name: '우유', evidence_level: 'may_contain' }] })
    expect(l).toEqual(['함유: 밀, 대두', '혼입: 우유'])
  })
  it('알레르기 안 읽음 / 읽고 0종을 구분한다', () => {
    expect(describeProposed('allergens', { inspected: false })).toEqual(['알레르기 항목을 읽지 않은 제보'])
    expect(describeProposed('allergens', { inspected: true, allergens: [] })).toEqual(['읽었고 0종'])
  })
  it('영양은 한글 이름 + 값, null 은 뺀다', () => {
    expect(describeProposed('nutrition', { nutrition: { calories: 155, sodium: null, protein: 9 } })).toEqual(['열량 155 · 단백질 9'])
  })
  it('원재료·첨가물·없음', () => {
    expect(describeProposed('ingredients', { ingredients: ['설탕', '밀가루'] })).toEqual(['설탕, 밀가루'])
    expect(describeProposed('additives', { ingredient_names: ['a', 'b'] })[0]).toContain('2개')
    expect(describeProposed('nutrition', null)).toEqual(['(제보 값 없음)'])
  })
})

describe('배선', () => {
  const app = readFileSync(join(SRC, 'App.tsx'), 'utf8')
  it('/admin 라우트가 있다', () => { expect(app).toMatch(/<Route path="\/admin" element={<Admin \/>} \/>/) })
  it('전역 메뉴 컴포넌트에 /admin 링크가 없다(일반 사용자에게 안 보임)', () => {
    const dirs = ['components', 'components/layout'].map((d) => join(SRC, d))
    for (const d of dirs) {
      let files: string[] = []
      try { files = readdirSync(d).filter((f) => /nav|header|menu|layout/i.test(f) && f.endsWith('.tsx')) } catch { /* 없음 */ }
      for (const f of files) expect(readFileSync(join(d, f), 'utf8')).not.toContain("'/admin'")
    }
  })
  it('Account 의 관리자 링크는 서버 판정(adminWhoami) 결과에만 달린다', () => {
    const acc = readFileSync(join(SRC, 'pages/Account.tsx'), 'utf8')
    expect(acc).toContain('adminWhoami()')
    expect(acc).toMatch(/\{isAdmin && <button[^\n]*navigate\('\/admin'\)/)
  })
})
