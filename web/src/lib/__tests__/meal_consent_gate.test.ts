import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  hasConsentedMeal, markMealConsent, revokeMealConsent,
  MEAL_CONSENT_POLICY_VERSION,
} from '../mealConsent'

/**
 * ★ 2026-08-28 신설 — 「로컬은 동의함, 서버는 기록 없음」으로 사용자가 갇히는 사고 방지.
 *
 * 실제로 일어난 일:
 *   1. 계정 A 로 식사 사진 동의  → 로컬 캐시에 'accepted' 저장 + 서버(A)에 기록
 *   2. 계정 A 가 없어져 계정 B 로 로그인
 *      → 로그아웃이 로컬 캐시를 «안 지웠다»
 *   3. 로컬 = 동의함  →  Meal.tsx 가 게이트를 건너뜀
 *      서버(B) = 기록 없음  →  Edge(meal-analysis-jobs)가 계속 403
 *      `meal photo consent (sensitive info + intl transfer) required`
 *   4. Account 의 철회 버튼은 «서버» 기준이라 `disabled` → 탈출구가 없음
 *   ⇒ 사진 촬영·갤러리 분석이 전면 차단, 사용자가 스스로 복구 불가.
 *
 * 네 지점이 모두 「실패가 조용히 넘어간다」는 같은 형태였다. 아래 검사는 그 넷을 고정한다.
 * 소스 문자열 검사인 이유: 이 파일들은 supabase 클라이언트를 모듈 로드 시점에 만들어
 * 단위 테스트에서 그대로 import 하기 어렵다. 동작은 tsc + 수동 확인으로 봤고,
 * 여기서는 «되돌려지면 잡히게» 하는 것이 목적이다.
 */

const SRC = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(SRC, p), 'utf-8')

/**
 * 함수 하나의 본문만 잘라낸다.
 * ⚠ 초판은 `indexOf('\n}')` 로 끝을 찾았는데, 그러면 «다음 함수»까지 딸려 들어와
 *   옆 함수(revokeMealConsentServer)의 `if (!user) return` 이 걸려 오검출이 났다.
 *   세션49 규칙50 이 경고한 것과 같은 실수다 — 다음 최상위 export 앞에서 끊는다.
 */
function fnBody(src: string, name: string): string {
  const i = src.indexOf(name)
  if (i < 0) return ''
  const rest = src.slice(i)
  const j = rest.indexOf('\nexport ', 1)
  const k = rest.indexOf('\n  }', 1)          // 클래스/컴포넌트 내부 함수용
  const end = j > 0 ? j : (k > 0 ? k + 4 : rest.length)
  return rest.slice(0, end)
}

/**
 * 주석을 걷어낸 «실제 코드»만 남긴다.
 * ⚠ 필요한 이유: 이 코드의 주석에는 «고치기 전의 코드»가 인용돼 있다
 *   (예: `// 예전에는 if (!user) return 이었다`). 주석을 안 걸러내면
 *   그 인용이 검사에 걸려, 제대로 고쳐 놓고도 실패한다. 실제로 그랬다.
 *   소스 문자열을 검사할 때는 «무엇이 코드이고 무엇이 설명인지»를 갈라야 한다.
 */
function codeOf(body: string): string {
  return body
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

describe('식사 동의 — 로컬 캐시 단독 동작 (순수)', () => {
  beforeEach(() => {
    // 이 테스트 환경은 node 라 localStorage 가 없다. 최소 스텁을 주입한다.
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => { store.clear() },
    })
  })

  it('기본값은 미동의', () => {
    expect(hasConsentedMeal()).toBe(false)
  })

  it('동의 기록 후 true, 철회 후 다시 false', () => {
    markMealConsent()
    expect(hasConsentedMeal()).toBe(true)
    revokeMealConsent()
    expect(hasConsentedMeal()).toBe(false)
  })

  it('방침 버전이 다르면 미동의로 간주한다(재동의 게이트)', () => {
    markMealConsent()
    localStorage.setItem('sf_meal_consent_policy_version', 'OLD_VERSION')
    expect(hasConsentedMeal()).toBe(false)
    expect(MEAL_CONSENT_POLICY_VERSION).not.toBe('OLD_VERSION')
  })

  it('두 동의 중 하나만 있으면 통과하지 않는다', () => {
    markMealConsent()
    localStorage.removeItem('sf_meal_intl_consent')
    expect(hasConsentedMeal()).toBe(false)
  })
})

describe('★ 갇힘 방지 — 네 지점이 제자리에 있는가', () => {
  it('① 로그아웃이 로컬 동의 캐시를 정리한다 (Account.tsx)', () => {
    const body = fnBody(read('pages/Account.tsx'), 'async function handleLogout')
    expect(body.length).toBeGreaterThan(40)
    expect(body).toContain('signOut')
    expect(body).toMatch(/revokeMealConsent\(\)/)
    // 서버 철회를 부르면 «동의 자체»가 취소된다 — 로그아웃이 할 일이 아니다.
    expect(body).not.toMatch(/revokeMealConsentServer/)
  })

  it('② Meal.tsx 가 서버 상태를 권위로 삼는다', () => {
    const src = read('pages/Meal.tsx')
    expect(src).toContain('syncMealConsentFromServer')
    // 로컬만 보고 게이트를 정하던 초판으로 되돌아가면 잡힌다.
    expect(src).toMatch(/setConsented\(server \?\? hasConsentedMeal\(\)\)/)
  })

  it('③ markMealConsentServer 가 조용히 실패하지 않는다', () => {
    const body = fnBody(read('lib/mealConsent.ts'),
                        'export async function markMealConsentServer')
    // ★ 슬라이스가 옆 함수를 삼키지 않았는지 먼저 본다(규칙50).
    //   초판이 여기서 걸렸다 — revokeMealConsentServer 의 `if (!user) return` 이 딸려왔다.
    expect(body).toContain('markMealConsentServer')
    expect(body).not.toContain('revokeMealConsentServer')
    const code = codeOf(body)                  // 주석의 «옛 코드 인용»을 걷어낸다
    expect(code).toContain('upsert')           // 자기점검: 코드가 실제로 남았는가
    // 예전: `if (!user) return` — 로그인 없으면 성공한 척했다.
    expect(code).not.toMatch(/if \(!user\) return\b/)
    expect(code).toMatch(/if \(!user\) throw/)
    // upsert 결과도 확인해야 한다.
    expect(code).toMatch(/if \(error\) throw error/)
  })

  it('④ 게이트가 서버 성공 뒤에만 로컬을 채우고, 실패하면 통과시키지 않는다', () => {
    const body = fnBody(read('components/MealConsentGate.tsx'),
                        'async function handleAccept')
    expect(body.length).toBeGreaterThan(100)
    expect(body).not.toContain('return (')     // JSX 까지 삼키지 않았는가
    const code = codeOf(body)
    const iServer = code.indexOf('markMealConsentServer')
    const iLocal = code.indexOf('markMealConsent()')
    expect(iServer).toBeGreaterThan(-1)
    expect(iLocal).toBeGreaterThan(-1)
    // 서버 기록이 «먼저» 와야 한다. 순서가 뒤집히면 초판 사고가 재현된다.
    expect(iServer).toBeLessThan(iLocal)
    // 실패를 삼키고 지나가면 안 된다.
    expect(code).not.toMatch(/catch\s*\{\s*\}/)
    expect(code).toMatch(/\breturn\b/)        // 실패 시 조기 반환
    expect(code).toContain('setSaveError')    // 사용자에게 보인다
  })

  it('검사기 자기점검 — 대상 파일을 실제로 읽었는가', () => {
    // 경로나 함수명이 바뀌면 위 검사들이 «빈 문자열»을 통과시킬 수 있다(규칙50).
    for (const p of [
      'pages/Account.tsx', 'pages/Meal.tsx',
      'lib/mealConsent.ts', 'components/MealConsentGate.tsx',
    ]) {
      expect(read(p).length).toBeGreaterThan(500)
    }
    expect(read('pages/Account.tsx')).toContain('handleLogout')
    expect(read('components/MealConsentGate.tsx')).toContain('handleAccept')
  })
})
