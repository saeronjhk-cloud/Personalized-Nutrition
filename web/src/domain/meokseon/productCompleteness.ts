/**
 * 「이미 등록된 제품」의 정보 결손 판정 — 순수 함수(렌더 비의존, 테스트 대상).
 *
 * ★ 왜 생겼나 (2026-08-23, 세션64 외부검토 · 검토자 2명이 P0 로 지목)
 *   `Scan.tsx` 의 제보 UI 는 **「DB 에 없는 바코드」일 때만** 떴다(`notFound` 분기).
 *   ⇒ 영양정보가 빈 채로 한 번 등록되면 그 제품은 「있음」이 되어 **제보 화면이 다시 뜨지 않는다.**
 *     사용자가 고칠 경로가 «구조적으로» 없다.
 *   ⇒ 검토자 표현: **「낮은 품질의 첫 제보가 미래의 고품질 제보를 차단한다.」**
 *     등록 게이트를 아무리 조여도 이 문제는 해결되지 않는다 — 조일수록 첫 제보가 더 얇아진다.
 *
 * ★★ 이 파일이 지키는 것은 「빈 곳 찾기」가 아니라 **「모르는 것을 없다고 말하지 않기」** 다.
 *
 *   ① **`0` 과 `없음` 을 구분한다.** 나트륨 0mg 인 제품과 나트륨을 못 읽은 제품은 다르다.
 *      `0` 은 숫자다 → 「정보 있음」이다. 「영양정보가 아직 없어요」를 띄우면 **거짓말**이다.
 *      (이 저장소의 핵심 도크트린 — `allergens.ts:15` · `additives.ts` 의 `num()` 과 같은 축.)
 *
 *   ② **원재료는 「없다」고 말하지 않는다 — 우리가 모른다.**
 *      실측(2026-08-23, `meokseon-server/src/services/productService.js`
 *      `getProductWithTrafficLight()` 의 return 객체 전수 확인):
 *        응답 키는 product · nutrition · traffic_light · mfras · allergens · allergens_v2 ·
 *        allergens_available · allergens_flat_complete · context · sources · data_freshness.
 *      **원재료(ingredients)가 없다.** `product_ingredients` 테이블은 있고 저장도 되지만
 *      조회 응답에 실리지 않는다.
 *      ⇒ 앱은 「원재료 정보가 없다」를 **판정할 수 없다.** 그래서 `'unknown'` 이라는 상태를 둔다.
 *        `'unknown'` 은 결손 배너를 «띄우지 않는다». 서버가 이 키를 실어 주면 그 순간부터
 *        `'missing'` 판정이 살아나고 배너가 자동으로 켜진다(아래 `readIngredients` 참조).
 *
 *   ③ **「일부만 있음」을 따로 두지 않았다.** 임계값을 정할 근거가 없고(몇 개부터 「충분」인가?),
 *      더 중요하게는 **서버가 그 보탬을 받지 못한다** —
 *      `crowdsourceService.saveOcrContribution()` 의 영양 INSERT 가
 *      `ON CONFLICT (product_id) DO NOTHING` 이라, 영양 행이 이미 있으면 새 값이 «들어가지 않는다».
 *      ⇒ 부분 결손에 눈에 띄는 CTA 를 띄우면 **지킬 수 없는 약속**이 된다.
 *        부분 결손은 조용한 보조 동작(「정보 수정·추가」)이 담당한다. 제보 자체는
 *        `contributions` 에 남아 사람 검토·머지로 갈 수 있으므로 헛되지 않는다.
 *
 * 참고 선례: 같은 폴더 `allergens.ts` · `additives.ts` · `photoReport.ts`.
 *   판정은 여기, 그리기는 화면.
 */

/* ──────────────────────────────────────────────────────────────────────────
 * 1. 사용자에게 보이는 문구 — 정본은 여기 «한 곳»이다. 화면에 다시 적지 말 것.
 * ────────────────────────────────────────────────────────────────────────── */

export const NUTRITION_MISSING_HEADLINE = '영양정보가 아직 없어요'
export const NUTRITION_MISSING_CTA = '영양성분표 사진 추가'

export const INGREDIENTS_MISSING_HEADLINE = '원재료 정보가 아직 없어요'
export const INGREDIENTS_MISSING_CTA = '원재료 표기 사진 추가'

/** 결손이 없을 때의 보조 동작. **눈에 띄지 않아야 한다** — 멀쩡한 제품에 경고처럼 보이면 안 된다. */
export const COMPLETE_CTA = '정보 수정·추가'

/**
 * 결손 배너에 함께 내는 한 줄.
 * ⚠ 「보내면 반영됩니다」라고 말하지 «않는다». 서버에는 신뢰도·이상치·중복 게이트가 있어
 *   반려될 수 있다(`crowdsourceService.js`). 지킬 수 있는 말만 한다.
 */
export const GAP_HELP_TEXT =
  '이 제품은 등록돼 있지만 아직 채워지지 않은 정보가 있어요. 라벨 사진을 보내주시면 검토 후 반영해 드릴게요.'

/* ──────────────────────────────────────────────────────────────────────────
 * 2. 영양 결손
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 「영양정보가 있다」의 정의에 쓰는 키.
 *
 * ★ 근거 — **화면이 실제로 그리는 것과 같은 목록**이어야 한다(`pages/Scan.tsx` 의 `NUTRIENTS`).
 *   판정 목록과 표시 목록이 다르면 「있다고 판정했는데 표에는 아무것도 없는」 상태가 생긴다.
 *   지금이 정확히 그 상태였다: `Scan.tsx` 는 `result.nutrition` 객체의 «존재»만 보고 카드를 그리고,
 *   각 줄은 값이 숫자가 아니면 건너뛴다 ⇒ 값이 전부 null 이면 **빈 표가 남는다.**
 */
export const NUTRITION_KEYS = [
  'calories', 'protein', 'total_fat', 'saturated_fat', 'trans_fat',
  'cholesterol', 'sodium', 'total_carbs', 'total_sugars', 'dietary_fiber',
] as const

export interface NutritionCompleteness {
  /** 'missing' = 숫자로 읽히는 값이 **하나도** 없다. 'present' = 하나 이상 있다. */
  state: 'present' | 'missing'
  /** 숫자로 읽힌 항목 수. ⚠ 값이 `0` 인 항목도 «있음»으로 센다. */
  knownCount: number
  /** 우리가 보는 항목 총수(= NUTRITION_KEYS.length) */
  totalCount: number
}

/**
 * 숫자인가. **`0` 은 숫자다.**
 * ⚠ `Number(v)` 로 문자열까지 받아들이지 않는다 —
 *   `lib/meokseon.ts:normalizeNutrition` 이 경계에서 이미 숫자로 좁혀 준다.
 *   여기서 다시 문자열을 해석하면 `''` · `'-'` 같은 값이 조용히 0 이 된다.
 *   ★ 단, 방어적으로 «숫자로 보이는 문자열»만 인정한다(다른 경로에서 온 원본 행 대비).
 */
function isNumeric(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return false
    return Number.isFinite(Number(s))
  }
  return false
}

export function readNutrition(nutrition: unknown): NutritionCompleteness {
  const totalCount = NUTRITION_KEYS.length
  if (!nutrition || typeof nutrition !== 'object') {
    return { state: 'missing', knownCount: 0, totalCount }
  }
  const row = nutrition as Record<string, unknown>
  let knownCount = 0
  for (const k of NUTRITION_KEYS) if (isNumeric(row[k])) knownCount += 1
  return { state: knownCount > 0 ? 'present' : 'missing', knownCount, totalCount }
}

/* ──────────────────────────────────────────────────────────────────────────
 * 3. 원재료 결손 — ★ 지금은 «판정 불가»가 정상 결과다
 * ────────────────────────────────────────────────────────────────────────── */

export interface IngredientsCompleteness {
  /**
   * 'unknown' = **서버 응답에 원재료 키가 없다.** 「없다」가 아니라 「모른다」다.
   *   2026-08-23 현재 `GET /api/products/:barcode` 는 이 상태다(파일 상단 ② 참조).
   */
  state: 'present' | 'missing' | 'unknown'
  /** 읽어낸 원재료 수. 판정 불가면 null. */
  count: number | null
}

/**
 * 원재료 유무.
 *
 * ⚠ 키가 «아예 없으면»(`undefined`) `'unknown'` 이다. `null` 이나 빈 배열이면 `'missing'` 이다.
 *   이 구분이 이 함수의 전부다 — 서버가 「없다」고 «말한» 것과 「말하지 않은」 것은 다르다.
 *   (같은 도크트린: `productService.js` 가 알레르기 미수집을 `[]` 가 아니라 `null` 로 내는 이유.)
 */
export function readIngredients(product: Record<string, unknown> | null | undefined): IngredientsCompleteness {
  if (!product || typeof product !== 'object') return { state: 'unknown', count: null }

  const hasKey = 'ingredients' in product || 'ingredients_text' in product
  if (!hasKey) return { state: 'unknown', count: null }

  const list = product['ingredients']
  if (Array.isArray(list)) {
    const n = list.filter((x) => {
      if (typeof x === 'string') return x.trim().length > 0
      if (x && typeof x === 'object') return String((x as Record<string, unknown>)['name'] ?? '').trim().length > 0
      return false
    }).length
    if (n > 0) return { state: 'present', count: n }
  }

  const text = product['ingredients_text']
  if (typeof text === 'string' && text.trim()) return { state: 'present', count: null }

  return { state: 'missing', count: 0 }
}

/* ──────────────────────────────────────────────────────────────────────────
 * 4. 화면이 쓰는 결과
 * ────────────────────────────────────────────────────────────────────────── */

export type ProductGapKind = 'nutrition' | 'ingredients'

export interface ProductGap {
  kind: ProductGapKind
  /** 「영양정보가 아직 없어요」 */
  headline: string
  /** 버튼 문구 */
  cta: string
}

export interface ProductCompleteness {
  nutrition: NutritionCompleteness
  ingredients: IngredientsCompleteness
  /** 눈에 띄게 띄울 결손. 비어 있으면 보조 동작만 낸다. */
  gaps: ProductGap[]
  /** gaps.length === 0. 「완전하다」는 뜻이 **아니라** 「우리가 아는 결손이 없다」는 뜻이다. */
  complete: boolean
  /** 결손이 없을 때 쓰는 보조 동작 문구. 언제나 채워진다(화면이 조건 없이 쓸 수 있게). */
  fallbackCta: string
}

/**
 * 조회 성공 응답에서 필요한 부분만. 전체 타입에 묶이지 않는다(테스트 편의 · 선례 `AdditiveSummaryLike`).
 * ⚠ `interface` 가 아니라 **type alias** 다. interface 는 암묵적 인덱스 시그니처가 없어서
 *   `MsProductResult` 를 그대로 넘길 수 없다(TS2345). 경계에서 타입 때문에 배선이 막히면 안 된다.
 */
export type ProductResultLike = {
  nutrition?: unknown
  /** ⚠ 2026-08-23 현재 서버가 «보내지 않는» 키. 생기면 원재료 결손 판정이 자동으로 살아난다. */
  ingredients?: unknown
  ingredients_text?: unknown
}

export function assessProduct(result: ProductResultLike | null | undefined): ProductCompleteness {
  const nutrition = readNutrition(result?.nutrition)
  const ingredients = readIngredients((result ?? null) as Record<string, unknown> | null)

  const gaps: ProductGap[] = []
  if (nutrition.state === 'missing') {
    gaps.push({ kind: 'nutrition', headline: NUTRITION_MISSING_HEADLINE, cta: NUTRITION_MISSING_CTA })
  }
  // ⚠ 'unknown' 은 배너를 띄우지 않는다. 「모른다」를 「없다」로 말하지 않기 위해서다.
  if (ingredients.state === 'missing') {
    gaps.push({ kind: 'ingredients', headline: INGREDIENTS_MISSING_HEADLINE, cta: INGREDIENTS_MISSING_CTA })
  }

  return { nutrition, ingredients, gaps, complete: gaps.length === 0, fallbackCta: COMPLETE_CTA }
}
