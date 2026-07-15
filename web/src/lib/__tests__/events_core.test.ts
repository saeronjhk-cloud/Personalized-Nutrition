import { describe, it, expect } from 'vitest'
import { surfaceOf, sanitize, ALLOWED_PROP_KEYS, type AppEvent } from '../events_core'

describe('surfaceOf (이벤트 접두 → sink)', () => {
  it('1. scan_* → scan', () => {
    expect(surfaceOf('scan_page_view')).toBe('scan')
    expect(surfaceOf('scan_saved')).toBe('scan')
  })
  it('2. meal_* → meal', () => {
    expect(surfaceOf('meal_page_view')).toBe('meal')
    expect(surfaceOf('meal_analyze_success')).toBe('meal')
    expect(surfaceOf('meal_session_close')).toBe('meal')
    expect(surfaceOf('meal_leftover_apply')).toBe('meal')
  })
  it('3. weekly_report* → report', () => {
    expect(surfaceOf('weekly_report_view')).toBe('report')
  })
})

describe('sanitize (PII 차단 화이트리스트)', () => {
  it('4. 허용 키만 통과', () => {
    expect(sanitize({ source: 'photo', food_count: 3 })).toEqual({ source: 'photo', food_count: 3 })
  })
  it('5. 미허용 키(음식명·건강값 등) 제거', () => {
    expect(sanitize({ food_name: '설렁탕', kcal: 610, food_count: 2 } as any)).toEqual({ food_count: 2 })
  })
  it('6. 전부 미허용 → null (빈 객체 아님)', () => {
    expect(sanitize({ secret: 'x' } as any)).toBeNull()
  })
  it('7. undefined → null', () => {
    expect(sanitize(undefined)).toBeNull()
  })
  it('8. meal/report 프롭 키 통과(plate_count/mode/method/cached/has_data)', () => {
    const p = { plate_count: 3, mode: 'perfood', method: 'slider', cached: true, has_data: false }
    expect(sanitize(p)).toEqual(p)
  })
})

describe('ALLOWED_PROP_KEYS (DB app_event_props_keys와 동일 집합)', () => {
  it('9. scan+meal 키 모두 포함', () => {
    for (const k of ['source', 'error_kind', 'saved_to',
      'food_count', 'plate_count', 'mode', 'method', 'cached', 'has_data']) {
      expect(ALLOWED_PROP_KEYS.has(k)).toBe(true)
    }
  })
  it('10. 임의 PII 키는 불포함', () => {
    expect(ALLOWED_PROP_KEYS.has('food_name')).toBe(false)
    expect(ALLOWED_PROP_KEYS.has('user_id')).toBe(false)
  })
})

// 컴파일 타임 보증: 아래 이벤트들이 AppEvent 유니온에 존재(오타/누락 방지)
const _coverage: AppEvent[] = [
  'meal_page_view', 'meal_consent_shown', 'meal_consent_accepted', 'meal_capture_start',
  'meal_analyze_success', 'meal_analyze_error', 'meal_saved',
  'meal_session_start', 'meal_session_close', 'meal_leftover_open', 'meal_leftover_apply',
  'weekly_report_view',
]
describe('AppEvent 유니온 커버리지', () => {
  it('11. meal/report 이벤트 12종 정의됨', () => {
    expect(_coverage.length).toBe(12)
    expect(new Set(_coverage).size).toBe(12)
  })
})
