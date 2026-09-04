import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL_APP_EVENTS, ALLOWED_PROP_KEYS } from '../events_core'

/**
 * 계측 화이트리스트 ↔ DB CHECK 제약 대조.
 *
 * 왜 이 테스트가 있나 (2026-08-06 실측):
 *   `events_core.ts` 는 파일 머리에 「DB app_event_event_enum / app_event_props_keys
 *   제약과 1:1 유지」라고 적어 두었다. **사실이 아니었다.**
 *
 *       이벤트  TS 27 vs DB 13  →  14 종이 CHECK 위반으로 INSERT 거부
 *       props   TS 15 vs DB  9  →   6 키가 CHECK 위반으로 INSERT 거부
 *
 *   `track()` 이 fire-and-forget(실패를 삼킴)이라 화면에도 로그에도 아무 티가 안 났고,
 *   그래서 **NutriLens 식사기록 퍼널 11개 이벤트가 한 건도 안 쌓인 채** 지표로 쓰였다.
 *   「주석이 사실이라고 믿는 것」만으로는 정합을 지킬 수 없다는 게 실측으로 드러났다.
 *
 *   이 테스트는 그 주석을 **실행 가능한 단정**으로 바꾼 것이다.
 *   한쪽만 고치면 여기가 빨개진다.
 *
 * ⚠ 이 테스트는 «마이그레이션 파일»을 본다. 운영 DB 에 실제로 적용됐는지는 보지 못한다.
 *   SQL 파일을 만들고 Supabase 에 붙여넣지 않으면 여전히 초록이다. 적용은 사람이 해야 한다.
 */

// 세션52: 150 이 149 를 대체하는 전체 재동기화다. 새 마이그레이션을 만들면 여기도 옮길 것.
const SQL_PATH = resolve(__dirname, '../../../supabase/150_app_event_meal_correction_v1.sql')
const sql = readFileSync(SQL_PATH, 'utf8')

/** SQL 문자열에서 주석(-- …)을 걷어낸다. 주석 속 예시 이름을 목록으로 오인하지 않기 위해. */
function stripSqlComments(s: string): string {
  return s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
}
function quoted(block: string): string[] {
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

const body = stripSqlComments(sql)

describe('app_event 이벤트 목록 ↔ 마이그레이션 CHECK 제약', () => {
  const m = body.match(/app_event_event_enum check \(event in \(([\s\S]*?)\)\)/)

  it('마이그레이션에서 이벤트 CHECK 제약을 찾을 수 있다', () => {
    expect(m, '150_app_event_meal_correction_v1.sql 에서 app_event_event_enum 을 못 찾았다').not.toBeNull()
  })

  it('★ TS 목록과 SQL 목록이 «같은 집합»이다 (한쪽만 고치면 여기서 걸린다)', () => {
    const inSql = quoted(m![1])
    const inTs = [...ALL_APP_EVENTS]

    const missingInSql = inTs.filter((e) => !inSql.includes(e))
    const missingInTs = inSql.filter((e) => !inTs.includes(e as AppEventName))

    expect(missingInSql, `SQL 에 없다 → 이 이벤트는 DB 가 «거부»한다: ${missingInSql.join(', ')}`).toEqual([])
    expect(missingInTs, `TS 에 없다 → SQL 이 낡았다: ${missingInTs.join(', ')}`).toEqual([])
  })

  it('중복이 없다', () => {
    const inSql = quoted(m![1])
    expect(new Set(inSql).size).toBe(inSql.length)
    expect(new Set(ALL_APP_EVENTS).size).toBe(ALL_APP_EVENTS.length)
  })

  it('이번에 추가한 사진 제보 이벤트 2종이 양쪽에 있다', () => {
    const inSql = quoted(m![1])
    for (const e of ['scan_report_submit', 'scan_report_error']) {
      expect(ALL_APP_EVENTS as readonly string[]).toContain(e)
      expect(inSql).toContain(e)
    }
  })

  it('★ 회귀 고정 — 종전에 «거부되던» 이벤트들이 이제 SQL 에 있다', () => {
    const inSql = quoted(m![1])
    // 2026-08-06 이전 DB 제약에 없어서 전부 버려지던 목록
    const previouslyRejected = [
      'scan_promote', 'scan_login_cta_click', 'weekly_report_view',
      'meal_page_view', 'meal_consent_shown', 'meal_consent_accepted',
      'meal_capture_start', 'meal_analyze_success', 'meal_analyze_error',
      'meal_saved', 'meal_session_start', 'meal_session_close',
      'meal_leftover_open', 'meal_leftover_apply',
    ]
    for (const e of previouslyRejected) expect(inSql, `${e} 가 다시 빠졌다`).toContain(e)
  })
})

describe('props 화이트리스트 ↔ 마이그레이션 CHECK 제약', () => {
  const m = body.match(/props - array\[([\s\S]*?)\]::text\[\]/)

  it('마이그레이션에서 props CHECK 제약을 찾을 수 있다', () => {
    expect(m, '150_app_event_meal_correction_v1.sql 에서 app_event_props_keys 를 못 찾았다').not.toBeNull()
  })

  it('★ TS 화이트리스트와 SQL 목록이 «같은 집합»이다', () => {
    const inSql = quoted(m![1])
    const inTs = [...ALLOWED_PROP_KEYS]

    const missingInSql = inTs.filter((k) => !inSql.includes(k))
    const missingInTs = inSql.filter((k) => !inTs.includes(k))

    expect(missingInSql, `SQL 에 없다 → 이 키가 붙은 이벤트는 «통째로» 거부된다: ${missingInSql.join(', ')}`).toEqual([])
    expect(missingInTs, `TS 에 없다 → 클라이언트 sanitize 가 미리 버린다: ${missingInTs.join(', ')}`).toEqual([])
  })

  it('★ 회귀 고정 — 종전에 거부되던 props 키가 이제 SQL 에 있다', () => {
    const inSql = quoted(m![1])
    for (const k of ['food_count', 'plate_count', 'mode', 'method', 'cached', 'has_data']) {
      expect(inSql, `${k} 가 다시 빠졌다`).toContain(k)
    }
  })

  it('사진 제보 props 2종이 양쪽에 있다', () => {
    const inSql = quoted(m![1])
    for (const k of ['saved', 'nutrition_count']) {
      expect(ALLOWED_PROP_KEYS.has(k)).toBe(true)
      expect(inSql).toContain(k)
    }
  })

  it('⚠ 개인정보 위험 키가 화이트리스트에 새어들지 않았다', () => {
    const forbidden = ['barcode', 'product_name', 'user_id', 'email', 'image', 'raw', 'text', 'name', 'food']
    for (const k of forbidden) {
      expect(ALLOWED_PROP_KEYS.has(k), `${k} 는 PII 유입 경로다`).toBe(false)
    }
  })
})

type AppEventName = typeof ALL_APP_EVENTS[number]
