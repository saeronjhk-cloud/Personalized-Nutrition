/**
 * 제보 «직후» 화면의 영양·신호등 판정 — 순수 함수(렌더 비의존, 테스트 대상).
 *
 * ★★ 왜 생겼나 (2026-08-23, 세션64b)
 *   제보자는 사진 두 장을 보내고 **「감사합니다」와 개수(「원재료 12개 · 영양성분 8개」)만**
 *   받았다. 그런데 서버는 1단계(`/api/ocr/multi-photo`) 응답에 이미
 *   `analysis.nutrition`(수치 전부) · `traffic_light` · `analysis.additives` · `ingredients` 를
 *   **전부 실어 보내고 있었다.** 앱의 `parsePhotoAnalysis` 가 개수만 뽑고 나머지를 버렸다.
 *   = 세션61 U60-7(알레르기 3키를 버리던 일)과 **정확히 같은 유형**이다.
 *
 * ★★★ 이 파일이 지키는 것 — 딱 둘이다.
 *
 *   ① **영양은 「저장된 경우에만」 보여준다.**
 *      서버가 영양을 버리는 사유는 6종이다(`photoReport.ts:NutritionRejectCode`).
 *      그중 `BASIS_UNKNOWN` 은 **숫자는 읽혔는데 「100g당인지 1회 제공량당인지」를 몰라**
 *      버린 것이다. 그 값을 화면에 그리면 **기준이 틀린 수치**가 나가고,
 *      그것으로 신호등을 칠하면 **색이 뒤집힌다**(과소경고).
 *      ⇒ `nutrition_status === 'ok'` 일 때만 낸다. **모르는 status 는 ok 가 아니다**
 *        (`photoReport.ts:classifyPhotoReportOutcome` 과 같은 규칙 — Render Conservative).
 *
 *   ② **기준(basis)을 모르면 숫자도 신호등도 내지 않는다.**
 *      「나트륨 800mg」은 1회 제공량당이냐 100g당이냐에 따라 **의미가 3~5배 달라진다.**
 *      기준을 모른 채 숫자만 내면 사용자는 자기 기준으로 읽는다 = 우리가 안 한 판정을
 *      사용자가 대신 해 버린다. 서버가 `ok` 를 줬다면 여기 걸릴 일이 없어야 하지만,
 *      **관문은 두 겹으로 둔다** — 서버 판정 하나에만 기대면 서버가 바뀌는 날 조용히 뚫린다.
 *
 * ⚠ 여기서 「영양을 못 읽었다」는 문구를 만들지 «않는다». 그건 `photoReport.ts` 의
 *   `NUTRITION_*` 가 이미 사유별로 갖고 있다. 두 곳에 두면 갈라진다(additives.ts 와 같은 규칙).
 *   이 파일의 문구는 **그쪽이 말하지 «않는» 경우**(status 는 ok 인데 화면이 못 그리는 경우)뿐이다.
 */
import type { MsNutrition, MsTrafficLight, TrafficLightColor } from '../../lib/meokseon'

/* ──────────────────────────────────────────────────────────────────────────
 * 1. 표기 기준(basis)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 서버 파서가 내는 표기 기준(`ocrParser.js:940`).
 * ⚠ `unknown` 은 여기 «없다» — 알 수 없는 값은 전부 null 로 좁힌다.
 */
export type NutritionBasis = 'per_serving' | 'per_100g' | 'per_100ml' | 'per_total'

/** 화면에 그대로 쓰는 기준 문구. 숫자 옆에 **반드시** 붙는다. */
export const BASIS_LABEL: Record<NutritionBasis, string> = {
  per_serving: '1회 제공량당',
  per_100g: '100g당',
  per_100ml: '100mL당',
  per_total: '총 내용량당',
}

export function normalizeBasis(raw: unknown): NutritionBasis | null {
  const v = typeof raw === 'string' ? raw.trim() : ''
  return (v === 'per_serving' || v === 'per_100g' || v === 'per_100ml' || v === 'per_total')
    ? v
    : null
}

/* ──────────────────────────────────────────────────────────────────────────
 * 2. 문구 — ★★ 안전 계약이다. 바꾸려면 제이 승인이 필요하다.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * `nutrition_status === 'ok'` 인데 **기준을 모르는** 경우.
 * 서버 판정과 앱 판정이 어긋난 상태다 — 사용자에게는 「지금은 못 보여준다」만 말한다.
 * (서버가 저장했으므로 「저장 안 됐다」고 말하면 그게 거짓이다. 그 말은 여기서 하지 않는다.)
 */
export const NUTRITION_BASIS_UNKNOWN_NOTE =
  '영양성분 숫자는 읽었지만 100g당인지 1회 제공량당인지 확인하지 못해 수치를 보여드리지 않아요. 기준이 틀리면 숫자의 뜻이 완전히 달라지거든요.'

/** 수치는 있는데 신호등 판정이 하나도 없을 때. **침묵하면 「안전」으로 읽힌다.** */
export const TRAFFIC_LIGHT_NONE_NOTE =
  '이 제품은 신호등 판정에 필요한 정보가 부족해 색을 매기지 못했어요. 안전하다는 뜻은 아니에요.'

/** 서버가 판정을 «보류»했을 때(`is_withheld`) — 몇 인분인지 몰라 1회분을 못 구한 경우 등. */
export const TRAFFIC_LIGHT_WITHHELD_NOTE =
  '1회에 얼마나 먹는지 알 수 없어 신호등 판정을 보류했어요. 안전하다는 뜻은 아니에요.'

/** 신호등 «대상 밖» 식품(주류·건강기능식품·원물 등). 사용자가 할 일이 없다. */
export const TRAFFIC_LIGHT_EXCLUDED_NOTE =
  '이 종류의 식품은 신호등 판정 대상이 아니에요.'

/** 신호등 색이 뜰 때 «항상» 함께 나가는 한 줄. 초록을 「안전 인증」으로 읽지 않게 한다. */
export const TRAFFIC_LIGHT_CAPTION =
  '신호등은 영양성분 하나하나를 기준치와 견준 결과예요. 초록이라도 제품 전체가 안전하다는 뜻은 아니에요.'

/* ──────────────────────────────────────────────────────────────────────────
 * 3. 표시할 항목
 * ────────────────────────────────────────────────────────────────────────── */

/** 수치 표에 그리는 영양소와 순서. 라벨 표기 순서를 따른다. */
const ROWS: { key: keyof MsNutrition; label: string; unit: string }[] = [
  { key: 'calories', label: '열량', unit: 'kcal' },
  { key: 'total_carbs', label: '탄수화물', unit: 'g' },
  { key: 'total_sugars', label: '당류', unit: 'g' },
  { key: 'dietary_fiber', label: '식이섬유', unit: 'g' },
  { key: 'protein', label: '단백질', unit: 'g' },
  { key: 'total_fat', label: '지방', unit: 'g' },
  { key: 'saturated_fat', label: '포화지방', unit: 'g' },
  { key: 'trans_fat', label: '트랜스지방', unit: 'g' },
  { key: 'cholesterol', label: '콜레스테롤', unit: 'mg' },
  { key: 'sodium', label: '나트륨', unit: 'mg' },
]

/**
 * 신호등 키 → 한국어. ⚠ 서버 키는 영양소 키와 «다르다»
 *   (`total_sugars` → `sugars`, `saturated_fat` → `sat_fat`, `dietary_fiber` → `fiber`).
 *   여기 없는 키가 오면 그리지 않는다 — 이름을 지어내지 않는다.
 */
const LIGHT_LABEL: Record<string, string> = {
  sodium: '나트륨',
  sugars: '당류',
  sat_fat: '포화지방',
  trans_fat: '트랜스지방',
  cholesterol: '콜레스테롤',
  total_fat: '지방',
  protein: '단백질',
  fiber: '식이섬유',
}

/** 신호등 표시 순서 — 「주의해서 볼 것」이 먼저다. */
const LIGHT_ORDER = ['sodium', 'sugars', 'sat_fat', 'trans_fat', 'cholesterol', 'total_fat', 'protein', 'fiber']

export interface ReportNutritionRow {
  key: string
  label: string
  unit: string
  value: number
}

export interface ReportTrafficLightItem {
  key: string
  label: string
  /** ⚠ null 은 여기 오지 않는다 — 판정된 것만 담는다. */
  color: 'green' | 'yellow' | 'red'
}

export interface ReportNutritionView {
  /** 수치 표를 그리는가. false 면 화면은 영양 «자리를 비운다». */
  show: boolean
  basis: NutritionBasis | null
  /** 「100g당」 등. `show` 면 **절대 null 이 아니다**(불변식 — 기준 없는 숫자를 내지 않는다). */
  basisLabel: string | null
  rows: ReportNutritionRow[]
  /** 신호등 색을 그리는가. `show === false` 면 언제나 false 다. */
  showLights: boolean
  lights: ReportTrafficLightItem[]
  /**
   * 화면이 «추가로» 할 말. null 이면 아무 말도 하지 않는다.
   * ⚠ `nutrition_status` 가 ok 가 아닌 경우에는 **여기서 말하지 않는다** —
   *   그 경우의 문구는 `photoReport.ts:classifyPhotoReportOutcome` 의 `nutritionNote` 다.
   *   두 곳이 동시에 말하면 화면이 같은 얘기를 두 번 하거나 서로 다른 말을 한다.
   */
  note: string | null
  /**
   * 계측용. ⚠ **화면에 쓰지 말 것.**
   *   'ok'              수치를 그렸다
   *   'not_ok'          서버가 영양을 저장하지 않았다(문구는 photoReport.ts 담당)
   *   'basis_unknown'   저장은 됐는데 앱이 기준을 못 읽었다 — **관측되면 서버와 어긋난 것이다**
   */
  code: 'ok' | 'not_ok' | 'basis_unknown'
}

const EMPTY: Omit<ReportNutritionView, 'note' | 'code'> = {
  show: false, basis: null, basisLabel: null, rows: [], showLights: false, lights: [],
}

function numeric(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickColor(v: unknown): TrafficLightColor {
  return (v === 'green' || v === 'yellow' || v === 'red') ? v : null
}

export interface ReportNutritionInput {
  /** 서버 `save_result.nutrition_status` 원문. **null = 서버가 말하지 않았다.** */
  nutritionStatus: string | null
  /** 1단계에서 읽어낸 영양 수치. */
  nutrition: MsNutrition | null
  /** 1단계 응답의 `analysis.nutrition._basis`. */
  basis: string | null
  /** 1단계 응답의 `traffic_light`. */
  trafficLight: MsTrafficLight | null
}

/**
 * 「제보 직후에 무엇을 보여줄 것인가」.
 *
 * ★ 관문 순서가 곧 안전 정책이다. 뒤바꾸지 말 것.
 *   ① 저장됐는가(`status === 'ok'`)  → 아니면 아무것도 안 낸다
 *   ② 기준을 아는가(`basis`)          → 모르면 숫자도 색도 안 낸다
 *   ③ 그릴 수치가 있는가              → 없으면 표를 그리지 않는다
 *   ④ 신호등이 «판정»했는가           → 보류·제외·전부 회색이면 색 대신 «말»을 한다
 */
export function buildReportNutrition(input: ReportNutritionInput): ReportNutritionView {
  // ① — 「ok」 만 ok 다. null(구버전 서버)도, 'incomplete' 도, 서버가 새로 만든 값도 아니다.
  const status = input.nutritionStatus?.trim() || null
  if (status !== 'ok') {
    return { ...EMPTY, note: null, code: 'not_ok' }
  }

  // ② — 기준.
  //
  // ★ 두 곳을 본다. `analysis.nutrition._basis` «하나만» 보면 안 된다:
  //   영양표 사진에 기준 문구가 안 찍히고 «라벨 사진» 쪽에 찍힌 제품이 흔해서,
  //   서버는 합친 텍스트로 기준을 다시 판정한다(`ocrRoutes.js:280` 세션42).
  //   그때 `_basis` 는 'unknown' 인 채로 남고 **실제 판정 근거는 `traffic_light.basis_detected`** 다.
  //   `_basis` 만 보면 서버가 멀쩡히 기준을 알아낸 건까지 화면이 가려 버린다.
  // ★ `basis_uncertain` 은 서버가 「이 기준으로는 판정하지 않겠다」고 말한 것이다.
  //   그 말이 있으면 다른 값이 뭐라 하든 **모르는 것으로 본다**(서버 판정이 우선).
  const tl = input.trafficLight
  const basisUncertain = (tl as any)?.basis_uncertain === true
  const basis = basisUncertain
    ? null
    : (normalizeBasis(input.basis) ?? normalizeBasis((tl as any)?.basis_detected))
  if (!basis) {
    return { ...EMPTY, note: NUTRITION_BASIS_UNKNOWN_NOTE, code: 'basis_unknown' }
  }

  // ③ — 수치.
  const n = input.nutrition
  const rows: ReportNutritionRow[] = []
  if (n) {
    for (const r of ROWS) {
      const v = numeric(n[r.key])
      // ⚠ 0 은 «있는 값»이다. `if (!v)` 로 거르면 나트륨 0mg 이 사라진다.
      if (v === null) continue
      rows.push({ key: String(r.key), label: r.label, unit: r.unit, value: v })
    }
  }
  if (!rows.length) {
    // 서버는 ok 라는데 우리 손에 숫자가 없다 = 응답을 잘못 읽고 있다는 뜻이다.
    // 「없다」고 조용히 넘기지 않고, 신호등도 함께 접는다(근거 없는 색을 남기지 않는다).
    return { ...EMPTY, basis, basisLabel: BASIS_LABEL[basis], note: null, code: 'basis_unknown' }
  }

  // ④ — 신호등.
  let lights: ReportTrafficLightItem[] = []
  let note: string | null = null

  if (!tl) {
    note = TRAFFIC_LIGHT_NONE_NOTE
  } else if ((tl as any).is_excluded === true) {
    note = TRAFFIC_LIGHT_EXCLUDED_NOTE
  } else if ((tl as any).is_withheld === true) {
    note = TRAFFIC_LIGHT_WITHHELD_NOTE
  } else {
    const nutrients = tl.nutrients || {}
    lights = LIGHT_ORDER
      .map((key) => ({ key, label: LIGHT_LABEL[key], color: pickColor(nutrients[key]?.color) }))
      .filter((x): x is ReportTrafficLightItem => !!x.label && x.color !== null)
    if (!lights.length) note = TRAFFIC_LIGHT_NONE_NOTE
  }

  return {
    show: true,
    basis,
    basisLabel: BASIS_LABEL[basis],
    rows,
    showLights: lights.length > 0,
    lights,
    note,
    code: 'ok',
  }
}
