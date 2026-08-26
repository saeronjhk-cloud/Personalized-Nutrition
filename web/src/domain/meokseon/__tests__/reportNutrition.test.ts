/**
 * 제보 «직후» 영양·신호등 판정.
 *
 * ★★ 이 파일이 지키는 것 — 딱 둘이다. 둘 다 「과소경고」를 막는 장치다.
 *   ① **영양은 저장된 경우에만 낸다.** 서버가 영양을 버리는 사유는 6종이다.
 *      그중 하나는 «숫자는 읽혔는데 기준을 몰라» 버린 것이다 —
 *      그 값으로 신호등을 그리면 **색이 뒤집힌다.**
 *   ② **기준(basis)을 모르면 숫자도 색도 내지 않는다.**
 *      「나트륨 800mg」은 1회 제공량당이냐 100g당이냐에 따라 뜻이 3~5배 달라진다.
 *
 * ⚠ 사유 코드별 «문구»는 여기서 만들지 않는다. `photoReport.ts` 가 정본이다.
 *   이 파일은 「무엇을 그릴 것인가」만 판정한다.
 */
import { describe, it, expect } from 'vitest'
import {
  buildReportNutrition, normalizeBasis, BASIS_LABEL,
  NUTRITION_BASIS_UNKNOWN_NOTE, TRAFFIC_LIGHT_NONE_NOTE,
  TRAFFIC_LIGHT_WITHHELD_NOTE, TRAFFIC_LIGHT_EXCLUDED_NOTE, TRAFFIC_LIGHT_CAPTION,
} from '../reportNutrition'
import type { MsNutrition, MsTrafficLight } from '../../../lib/meokseon'

const NUTRITION: MsNutrition = {
  calories: 500, sodium: 1790, total_sugars: 3.4, protein: 10.9,
  total_fat: 16.5, saturated_fat: 8.2, trans_fat: 0, cholesterol: 0,
  total_carbs: 79, dietary_fiber: 5,
}

const LIGHTS: MsTrafficLight = {
  nutrients: {
    sodium: { color: 'red' },
    sugars: { color: 'green' },
    sat_fat: { color: 'yellow' },
  },
}

/** 서버가 영양을 «저장했다»고 말한 정상 케이스. */
function ok(over: Partial<Parameters<typeof buildReportNutrition>[0]> = {}) {
  return buildReportNutrition({
    nutritionStatus: 'ok',
    nutrition: NUTRITION,
    basis: 'per_serving',
    trafficLight: LIGHTS,
    ...over,
  })
}

describe('normalizeBasis — 아는 값만 통과', () => {
  it('네 가지만 통과한다', () => {
    expect(normalizeBasis('per_serving')).toBe('per_serving')
    expect(normalizeBasis('per_100g')).toBe('per_100g')
    expect(normalizeBasis('per_100ml')).toBe('per_100ml')
    expect(normalizeBasis('per_total')).toBe('per_total')
  })
  it("★ 'unknown' 도, 모르는 값도 전부 null 로 좁힌다", () => {
    for (const v of ['unknown', '', '  ', 'per_pack', null, undefined, 42, {}]) {
      expect(normalizeBasis(v)).toBeNull()
    }
  })
})

describe('① 저장된 경우에만 영양을 낸다', () => {
  it("status 가 'ok' 면 수치를 그린다", () => {
    const v = ok()
    expect(v.show).toBe(true)
    expect(v.code).toBe('ok')
    expect(v.rows.length).toBeGreaterThan(0)
  })

  it('★★★ 영양 실패 6종 — 어느 사유든 영양 «자리를 비운다»', () => {
    const CODES = [
      'NO_NUTRIENTS', 'BASIS_UNKNOWN', 'PER_TOTAL_UNRESOLVED',
      'SANITY_OUTLIER', 'MASS_BALANCE', 'PUBLIC_DATA_PROTECTED',
    ]
    for (const _code of CODES) {
      // 서버는 6종 «전부» `nutrition_status: 'incomplete'` 로 내려보낸다.
      const v = buildReportNutrition({
        nutritionStatus: 'incomplete',
        nutrition: NUTRITION,     // ← 수치가 손에 «있어도» 그리지 않는다
        basis: 'per_serving',     // ← 기준을 «알아도» 그리지 않는다
        trafficLight: LIGHTS,
      })
      expect(v.show, _code).toBe(false)
      expect(v.showLights, _code).toBe(false)
      expect(v.rows, _code).toHaveLength(0)
      expect(v.lights, _code).toHaveLength(0)
      expect(v.code, _code).toBe('not_ok')
      // ⚠ 문구는 여기서 말하지 않는다 — photoReport.ts 의 nutritionNote 가 사유별로 말한다.
      //   두 곳이 동시에 말하면 화면이 같은 얘기를 두 번 하거나 서로 다른 말을 한다.
      expect(v.note, _code).toBeNull()
    }
  })

  it('★★ 모르는 status 는 ok 가 «아니다» (Render Conservative)', () => {
    for (const s of ['partial', 'PENDING', 'okay', '', '   ']) {
      expect(buildReportNutrition({
        nutritionStatus: s, nutrition: NUTRITION, basis: 'per_serving', trafficLight: LIGHTS,
      }).show, s).toBe(false)
    }
  })

  it('★★ 서버가 말이 없으면(null) 내지 않는다 — 「말이 없었다」를 「저장됐다」로 올리지 않는다', () => {
    expect(ok({ nutritionStatus: null }).show).toBe(false)
  })
})

describe('② 기준을 모르면 숫자도 색도 내지 않는다', () => {
  it('★★★ basis 가 없으면 수치·신호등을 «둘 다» 접는다', () => {
    const v = ok({ basis: null, trafficLight: LIGHTS })
    expect(v.show).toBe(false)
    expect(v.showLights).toBe(false)
    expect(v.lights).toHaveLength(0)
    expect(v.code).toBe('basis_unknown')
    // 서버는 저장했다고 했으므로 「저장 안 됐다」고 말하지 않고, 「지금은 못 보여준다」만 말한다.
    expect(v.note).toBe(NUTRITION_BASIS_UNKNOWN_NOTE)
  })

  it("★ basis 가 'unknown' 문자열이어도 «모르는 것»이다", () => {
    expect(ok({ basis: 'unknown', trafficLight: null }).show).toBe(false)
  })

  it('★★ `_basis` 가 없어도 서버가 판정한 `basis_detected` 로 살린다', () => {
    // 영양표 사진에 기준 문구가 없고 «라벨» 사진에 있는 제품이 흔하다(서버 세션42).
    const v = ok({ basis: 'unknown', trafficLight: { ...LIGHTS, basis_detected: 'per_100g' } as MsTrafficLight })
    expect(v.show).toBe(true)
    expect(v.basis).toBe('per_100g')
    expect(v.basisLabel).toBe(BASIS_LABEL.per_100g)
  })

  it('★★★ `basis_uncertain` 은 다른 값이 뭐라 하든 «모르는 것»이다 (서버 판정 우선)', () => {
    const v = ok({
      basis: 'per_serving',
      trafficLight: { ...LIGHTS, basis_detected: 'per_100g', basis_uncertain: true } as MsTrafficLight,
    })
    expect(v.show).toBe(false)
    expect(v.code).toBe('basis_unknown')
  })

  it('★ 수치를 그릴 때 기준 문구가 «반드시» 함께 온다 (불변식)', () => {
    for (const b of ['per_serving', 'per_100g', 'per_100ml', 'per_total'] as const) {
      const v = ok({ basis: b })
      expect(v.show, b).toBe(true)
      expect(v.basisLabel, b).toBe(BASIS_LABEL[b])
      expect(v.basisLabel, b).not.toBeNull()
    }
  })
})

describe('③ 수치 행', () => {
  it('0 은 «있는 값»이다 — 트랜스지방 0g 이 사라지지 않는다', () => {
    const v = ok()
    const keys = v.rows.map((r) => r.key)
    expect(keys).toContain('trans_fat')
    expect(v.rows.find((r) => r.key === 'trans_fat')?.value).toBe(0)
  })

  it('결측은 행을 만들지 않는다', () => {
    const v = ok({ nutrition: { sodium: 1790, calories: null } as MsNutrition })
    expect(v.rows.map((r) => r.key)).toEqual(['sodium'])
  })

  it('★★ 서버는 ok 인데 손에 숫자가 없으면 신호등도 «함께» 접는다', () => {
    const v = ok({ nutrition: null })
    expect(v.show).toBe(false)
    expect(v.showLights).toBe(false)
    expect(v.lights).toHaveLength(0)
  })
})

describe('④ 신호등', () => {
  it('판정된 항목만 담는다 — 회색(null)은 목록에 넣지 않는다', () => {
    const v = ok({
      trafficLight: { nutrients: { sodium: { color: 'red' }, sugars: { color: null } } } as MsTrafficLight,
    })
    expect(v.showLights).toBe(true)
    expect(v.lights.map((l) => l.key)).toEqual(['sodium'])
  })

  it('표시 순서는 「주의해서 볼 것」이 먼저다', () => {
    const v = ok()
    expect(v.lights.map((l) => l.key)).toEqual(['sodium', 'sugars', 'sat_fat'])
  })

  it('모르는 신호등 키는 «이름을 지어내지 않고» 버린다', () => {
    const v = ok({ trafficLight: { nutrients: { caffeine: { color: 'red' } } } as MsTrafficLight })
    expect(v.showLights).toBe(false)
    expect(v.note).toBe(TRAFFIC_LIGHT_NONE_NOTE)
  })

  it('★★ 신호등이 아예 없으면 «말»을 한다 — 침묵은 「안전」으로 읽힌다', () => {
    const v = ok({ trafficLight: null })
    expect(v.show).toBe(true)          // 수치는 그린다(저장됐고 기준도 안다)
    expect(v.showLights).toBe(false)
    expect(v.note).toBe(TRAFFIC_LIGHT_NONE_NOTE)
    expect(v.note).toMatch(/안전하다는 뜻은 아니/)
  })

  it('★★ 판정 보류(is_withheld)도 색 대신 말이다', () => {
    const v = ok({ trafficLight: { ...LIGHTS, is_withheld: true } as MsTrafficLight })
    expect(v.showLights).toBe(false)
    expect(v.note).toBe(TRAFFIC_LIGHT_WITHHELD_NOTE)
  })

  it('판정 «대상 밖» 식품은 사용자가 할 일이 없다고 말한다', () => {
    const v = ok({ trafficLight: { ...LIGHTS, is_excluded: true } as MsTrafficLight })
    expect(v.showLights).toBe(false)
    expect(v.note).toBe(TRAFFIC_LIGHT_EXCLUDED_NOTE)
    expect(v.note).not.toMatch(/안전/)
  })

  it('색이 뜨는 정상 케이스에는 note 가 없다 (캡션은 화면이 항상 붙인다)', () => {
    const v = ok()
    expect(v.note).toBeNull()
    expect(TRAFFIC_LIGHT_CAPTION).toMatch(/초록이라도/)
  })
})
