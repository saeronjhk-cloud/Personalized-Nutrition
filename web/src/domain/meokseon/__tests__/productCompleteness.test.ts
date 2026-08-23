import { describe, it, expect } from 'vitest'
import {
  assessProduct,
  readIngredients,
  readNutrition,
  NUTRITION_KEYS,
  NUTRITION_MISSING_HEADLINE,
  NUTRITION_MISSING_CTA,
  INGREDIENTS_MISSING_HEADLINE,
  INGREDIENTS_MISSING_CTA,
  COMPLETE_CTA,
  GAP_HELP_TEXT,
} from '../productCompleteness'

/**
 * 「이미 등록된 제품」의 결손 판정.
 *
 * 이 테스트가 지키는 것은 «빈 곳을 잘 찾는가»가 아니라 다음 셋이다.
 *   ① `0` 과 `없음` 을 구분한다        — 나트륨 0mg 제품에 「영양정보가 없어요」는 거짓말이다
 *   ② 「모른다」를 「없다」로 말하지 않는다 — 원재료는 서버가 아예 안 보낸다(판정 불가)
 *   ③ 결손이 없을 때 «경고처럼» 굴지 않는다
 *
 * fixture 근거:
 *   `meokseon-server/src/services/productService.js` getProductWithTrafficLight() 의 return
 *   (2026-08-23 전수 확인 — 응답에 원재료 키가 없다)
 *   `web/src/lib/meokseon.ts` normalizeNutrition() — 경계에서 숫자로 좁혀 온다
 */

/* 실물 모양 — 영양이 있는 제품(신라면류) */
const 영양있음 = {
  product: { product_id: 1, barcode: '8801043032155', product_name: '신라면' },
  nutrition: {
    calories: 500, protein: 10, total_fat: 16, saturated_fat: 8, trans_fat: 0,
    cholesterol: null, sodium: 1790, total_carbs: 79, total_sugars: 4, dietary_fiber: null,
  },
}

/* 실물 모양 — 등록은 됐는데 영양이 없는 제품. `nutrition` 자체가 null 로 온다.
   (productService.js: `product.calories !== null ? {…} : null`) */
const 영양없음 = {
  product: { product_id: 2, barcode: '8801000000000', product_name: '이름만 있는 제품' },
  nutrition: null,
}

describe('★ ① `0` 과 `없음` 을 구분한다 — 이 저장소의 핵심 도크트린', () => {
  it('★★ 나트륨 0mg 은 «있음»이다 — 「영양정보가 아직 없어요」를 띄우면 거짓말이다', () => {
    const r = readNutrition({ sodium: 0 })
    expect(r.state).toBe('present')
    expect(r.knownCount).toBe(1)
  })

  it('★★ 나트륨 null 은 «없음»이다 — 0 과 같은 칸에 넣지 않는다', () => {
    const r = readNutrition({ sodium: null })
    expect(r.state).toBe('missing')
    expect(r.knownCount).toBe(0)
  })

  it('값이 «전부» 0 이어도 정보는 있는 것이다', () => {
    const allZero: Record<string, number> = {}
    for (const k of NUTRITION_KEYS) allZero[k] = 0
    const r = readNutrition(allZero)
    expect(r.state).toBe('present')
    expect(r.knownCount).toBe(NUTRITION_KEYS.length)
  })

  it('★ 객체는 있는데 값이 전부 null 이면 «없음»이다 (화면에 빈 표만 남던 상태)', () => {
    const allNull: Record<string, null> = {}
    for (const k of NUTRITION_KEYS) allNull[k] = null
    expect(readNutrition(allNull).state).toBe('missing')
  })

  it('nutrition 이 null·undefined·비객체여도 터지지 않는다', () => {
    for (const bad of [null, undefined, 'x', 0, []]) {
      expect(readNutrition(bad).state).toBe('missing')
    }
  })

  it('빈 문자열·「-」 는 숫자가 아니다 (조용히 0 이 되면 안 된다)', () => {
    expect(readNutrition({ sodium: '' }).state).toBe('missing')
    expect(readNutrition({ sodium: '-' }).state).toBe('missing')
    // PG NUMERIC 이 문자열로 흘러오는 다른 경로 대비 — 숫자로 «읽히는» 문자열은 인정한다.
    expect(readNutrition({ sodium: '1790' }).state).toBe('present')
  })

  it('NaN·Infinity 는 값이 아니다', () => {
    expect(readNutrition({ sodium: NaN }).state).toBe('missing')
    expect(readNutrition({ sodium: Infinity }).state).toBe('missing')
  })

  it('우리가 «그리는» 항목만 센다 — 표에 없는 필드는 근거가 되지 않는다', () => {
    // source·confidence 같은 메타는 영양값이 아니다.
    expect(readNutrition({ source: 'off', confidence: 'low' }).state).toBe('missing')
  })
})

describe('★ ② 원재료 — 「모른다」를 「없다」로 말하지 않는다', () => {
  /**
   * 2026-08-23 실측: `GET /api/products/:barcode` 응답 키는
   *   product · nutrition · traffic_light · mfras · allergens · allergens_v2 ·
   *   allergens_available · allergens_flat_complete · context · sources · data_freshness
   * **원재료가 없다.** 그래서 앱은 원재료 결손을 «판정할 수 없다».
   */
  it('★★ 키가 아예 없으면 unknown 이다 — 지금의 서버 응답이 이 상태다', () => {
    const r = readIngredients(영양있음 as unknown as Record<string, unknown>)
    expect(r.state).toBe('unknown')
    expect(r.count).toBeNull()
  })

  it('★★ unknown 은 결손 배너를 «띄우지 않는다» (없다고 말하는 셈이 되므로)', () => {
    const a = assessProduct(영양있음)
    expect(a.ingredients.state).toBe('unknown')
    expect(a.gaps.map((g) => g.kind)).not.toContain('ingredients')
  })

  it('★ 서버가 키를 «보내면서» 비었다고 하면 그때는 missing 이다', () => {
    expect(readIngredients({ ingredients: [] }).state).toBe('missing')
    expect(readIngredients({ ingredients: null }).state).toBe('missing')
    expect(readIngredients({ ingredients_text: '   ' }).state).toBe('missing')
  })

  it('문자열 배열·객체 배열·원문 텍스트 어느 모양이어도 present 로 읽는다', () => {
    expect(readIngredients({ ingredients: ['정제수', '설탕'] })).toEqual({ state: 'present', count: 2 })
    expect(readIngredients({ ingredients: [{ name: '정제수' }] })).toEqual({ state: 'present', count: 1 })
    expect(readIngredients({ ingredients_text: '정제수, 설탕' })).toEqual({ state: 'present', count: null })
  })

  it('빈 이름만 있는 배열은 「읽지 못한 것」이지 「있는 것」이 아니다', () => {
    expect(readIngredients({ ingredients: ['', '   ', {}] }).state).toBe('missing')
  })

  it('★ 서버가 키를 싣기 시작하면 배너가 «자동으로» 켜진다 (배선을 다시 안 고쳐도 된다)', () => {
    const a = assessProduct({ ...영양있음, ingredients: [] })
    expect(a.gaps.map((g) => g.kind)).toContain('ingredients')
    expect(a.gaps.find((g) => g.kind === 'ingredients')!.headline).toBe(INGREDIENTS_MISSING_HEADLINE)
    expect(a.gaps.find((g) => g.kind === 'ingredients')!.cta).toBe(INGREDIENTS_MISSING_CTA)
  })
})

describe('★ ③ 결손 → 보탬 경로', () => {
  it('★★ 영양정보 없음 → 「영양정보가 아직 없어요」 + 「영양성분표 사진 추가」', () => {
    const a = assessProduct(영양없음)
    expect(a.nutrition.state).toBe('missing')
    expect(a.complete).toBe(false)
    expect(a.gaps).toHaveLength(1)
    expect(a.gaps[0]).toEqual({
      kind: 'nutrition',
      headline: NUTRITION_MISSING_HEADLINE,
      cta: NUTRITION_MISSING_CTA,
    })
  })

  it('★★ 둘 다 있으면(=아는 결손 없음) 눈에 띄는 배너가 «없다»', () => {
    const a = assessProduct({ ...영양있음, ingredients: ['정제수'] })
    expect(a.gaps).toEqual([])
    expect(a.complete).toBe(true)
    // 그래도 보조 동작 문구는 «언제나» 준비돼 있다(화면이 조건 없이 쓸 수 있게).
    expect(a.fallbackCta).toBe(COMPLETE_CTA)
  })

  it('★ 둘 다 없으면 둘 다 나온다 — 하나로 뭉치지 않는다', () => {
    const a = assessProduct({ ...영양없음, ingredients: [] })
    expect(a.gaps.map((g) => g.kind)).toEqual(['nutrition', 'ingredients'])
  })

  it('일부만 있는 영양은 «결손으로 세지 않는다»', () => {
    // 근거: 임계값을 정할 근거가 없고, 서버가 그 보탬을 받지도 못한다
    //   (`crowdsourceService.js` 영양 INSERT 가 `ON CONFLICT (product_id) DO NOTHING`).
    //   지킬 수 없는 약속을 띄우지 않는다 — 부분 결손은 조용한 보조 동작이 담당한다.
    const a = assessProduct({ nutrition: { calories: 500 } })
    expect(a.nutrition.state).toBe('present')
    expect(a.nutrition.knownCount).toBe(1)
    expect(a.gaps.map((g) => g.kind)).not.toContain('nutrition')
  })

  it('응답이 없거나 모양이 깨져도 터지지 않는다', () => {
    for (const bad of [null, undefined, {}]) {
      const a = assessProduct(bad as never)
      expect(a.nutrition.state).toBe('missing')
      expect(a.ingredients.state).toBe('unknown')
      expect(a.gaps.map((g) => g.kind)).toEqual(['nutrition'])
    }
  })
})

describe('★ 문구 — 지킬 수 있는 말만 한다', () => {
  it('「보내면 반영됩니다」라고 단정하지 않는다 (서버에 반려 게이트가 6개 있다)', () => {
    expect(GAP_HELP_TEXT).toContain('검토')
    expect(GAP_HELP_TEXT).not.toMatch(/바로 반영|즉시 반영|반영됩니다\./)
  })

  it('보조 동작 문구가 경고처럼 읽히지 않는다', () => {
    expect(COMPLETE_CTA).toBe('정보 수정·추가')
    expect(COMPLETE_CTA).not.toMatch(/오류|잘못|문제/)
  })
})
