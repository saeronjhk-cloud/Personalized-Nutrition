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
import {
  AdminApiError, gateFromError, describeProposed, initialEdit, buildOverrideValues, ALLERGENS_19,
  BASIS_OPTIONS, EMPTY_BASIS_FORM, buildBasisBody, isHeld,
} from '../meokseonAdmin'

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

describe('세션72f — 사진 보며 정정(편집기 순수 함수)', () => {
  it('19종 목록은 서버 ocrParser.ALLERGEN_NAMES 키와 같다(이름 한 글자라도 다르면 서버가 400)', () => {
    let src = ''
    try { src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../../backends/먹선/meokseon-server/src/services/ocrParser.js'), 'utf8') } catch { return }
    const m = src.match(/const ALLERGEN_NAMES = \{([\s\S]*?)\n\};/)
    if (!m) return   // 서버 저장소가 옆에 없는 환경(CI 단독 체크아웃)에서는 건너뜀
    const keys = [...m[1].matchAll(/^\s*'([^']+)'\s*:/gm)].map((x) => x[1])
    expect(keys).toEqual([...ALLERGENS_19])
  })
  it('알레르기: 제보값으로 초기화 · 그대로면 null(정정 없이 승인) · 바꾸면 19종 이름으로 contains/may_contain', () => {
    const a = { proposed: { inspected: true, allergens: [{ name: '밀', evidence_level: 'contains' }, { name: '대두', evidence_level: 'may_contain' }] } }
    const init = initialEdit('allergens', a)
    expect(init['밀']).toBe('contains'); expect(init['대두']).toBe('may_contain'); expect(init['우유']).toBe('none')
    expect(buildOverrideValues('allergens', { ...init }, init)).toBeNull()
    expect(buildOverrideValues('allergens', { ...init, 우유: 'contains', 대두: 'none' }, init))
      .toEqual({ allergens: { contains: ['우유', '밀'], may_contain: [] } })
  })
  it('알레르기: 이미 정정된 행은 정정값(effective)으로 초기화', () => {
    const a = { proposed: { allergens: [] }, effective: { proposed: { allergens: [{ name: '우유', evidence_level: 'contains' }] } } }
    expect(initialEdit('allergens', a)['우유']).toBe('contains')
  })
  it('원재료: 제보 이름을 쉼표로 · 바뀌면 ingredients_text', () => {
    const a = { proposed: { ingredients: ['밀가루', '설탕'] } }
    const init = initialEdit('ingredients', a)
    expect(init).toBe('밀가루, 설탕')
    expect(buildOverrideValues('ingredients', init, init)).toBeNull()
    expect(buildOverrideValues('ingredients', '밀가루(미국산), 설탕', init)).toEqual({ ingredients_text: '밀가루(미국산), 설탕' })
  })
  it('영양: 바뀐 칸만 · 빈칸은 null(비움) · 숫자 아님은 throw', () => {
    const a = { proposed: { nutrition: { total_fat: 32, sodium: 100 } } }
    const init = initialEdit('nutrition', a)
    expect(buildOverrideValues('nutrition', { ...init }, init)).toBeNull()
    expect(buildOverrideValues('nutrition', { ...init, total_fat: '3.2', sodium: '' }, init)).toEqual({ total_fat: 3.2, sodium: null })
    expect(() => buildOverrideValues('nutrition', { ...init, total_fat: 'abc' }, init)).toThrow()
  })
  it('배선: Admin 화면이 사진 패널·정정 편집기를 쓰고, 정정이 있으면 override 후 승인', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../pages/Admin.tsx'), 'utf8')
    expect(src).toMatch(/<PhotoPanel productId=/)
    expect(src).toMatch(/if \(action === 'approve' && ov\) await overrideReview\(/)
  })
})

describe('세션73 U72-12 — 표기 기준(basis) 채우기 · 다시 반영(retry)을 /admin 으로', () => {
  const F = (o: Partial<typeof EMPTY_BASIS_FORM>) => ({ ...EMPTY_BASIS_FORM, note: '라벨 사진 확인', ...o })
  it('기준 4종은 서버 contributionApply.CONTRIBUTION_BASIS_OK 와 같다(다르면 서버 400 INVALID_BASIS)', () => {
    let src = ''
    try { src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../../backends/먹선/meokseon-server/src/services/contributionApply.js'), 'utf8') } catch { return }
    const m = src.match(/const CONTRIBUTION_BASIS_OK = \[([^\]]*)\]/)
    if (!m) return
    const server = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect(BASIS_OPTIONS.map((o) => o.value)).toEqual(server)
  })
  it('기준만 + 근거 → 본문 {basis, note} (제공량은 보내지 않음)', () => {
    expect(buildBasisBody(F({ basis: 'per_100g' }))).toEqual({ ok: true, body: { basis: 'per_100g', note: '라벨 사진 확인' } })
  })
  it('기준 없음·모르는 값 · 근거 없음 → 거부', () => {
    expect(buildBasisBody(F({})).ok).toBe(false)
    expect(buildBasisBody(F({ basis: 'per_serving_x' })).ok).toBe(false)
    expect(buildBasisBody(F({ basis: 'per_serving', note: '  ' })).ok).toBe(false)
  })
  it('제공량: 값+단위 → 숫자·소문자 · 값만/단위만/0·음수·문자/kg → 거부', () => {
    expect(buildBasisBody(F({ basis: 'per_serving', serving_size: '30', serving_unit: 'G', total_content: '300', content_unit: 'g' })))
      .toEqual({ ok: true, body: { basis: 'per_serving', note: '라벨 사진 확인', serving_size: 30, serving_unit: 'g', total_content: 300, content_unit: 'g' } })
    for (const bad of [{ serving_size: '30' }, { serving_unit: 'g' }, { serving_size: '0', serving_unit: 'g' },
      { serving_size: '-1', serving_unit: 'g' }, { serving_size: 'abc', serving_unit: 'g' }, { total_content: '1', content_unit: 'kg' }]) {
      expect(buildBasisBody(F({ basis: 'per_serving', ...bad })).ok).toBe(false)
    }
  })
  it('isHeld — approved 이고 미반영(또는 서버 held=true)만', () => {
    expect(isHeld({ status: 'approved', applied_at: null })).toBe(true)
    expect(isHeld({ status: 'approved', applied_at: '2026-10-01' })).toBe(false)
    expect(isHeld({ status: 'candidate', held: false })).toBe(false)
    expect(isHeld({ status: 'approved', held: true, applied_at: null })).toBe(true)
    expect(isHeld(null)).toBe(false)
  })
  it('배선: Admin 이 BasisEditor·submitBasis 를 쓰고, 보류 행에 retry 버튼을 준다', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../pages/Admin.tsx'), 'utf8')
    expect(src).toMatch(/<BasisEditor /)
    expect(src).toMatch(/await submitBasis\(reviewId, body\)/)
    expect(src).toMatch(/act\(it\.product_id, 'retry', \[a\.review_id\]\)/)
    expect(src).not.toMatch(/고급 화면에서 채우기/)
  })
})
