/**
 * 식사 기록 흐름 v2 — 기록 상세 뷰 모델 + 먹은 양 상태 라벨 + 문구 (순수)
 * 설계 IP/integration/meal_flow_v2_design_v1.md · 평가 L·D (lib/__tests__/mealDetail.test.ts)
 * 숫자는 저장값(엔진·Edge 결과)을 «보여주기만» 한다 — 반올림 외 산식 없음.
 */
import { actualSummary, isAdjusted, slotLabel, type MealRecord } from './mealHistory'

export const ANALYZE_BUSY_MSG = '사진을 분석하고 있어요…'
export const ANALYZE_WAIT_MSG = '분석 중이에요… 음식이 많으면 조금 더 걸려요'

function n(v: unknown): number { return typeof v === 'number' && Number.isFinite(v) ? v : 0 }
const r1 = (v: unknown) => Math.round(n(v) * 10) / 10

/** 먹은 양 상태 라벨. 보정 없음·100% → null. 음식별 반영은 Edge 가 slider+평균 비율로 기록(구분 불가) → 같은 라벨. */
export function leftoverStatusLabel(r: MealRecord): string | null {
  if (!isAdjusted(r)) return null
  const ratio = r.eaten_ratio
  const valid = typeof ratio === 'number' && Number.isFinite(ratio) && ratio >= 0 && ratio <= 1
  if (valid && ratio >= 1) return null
  const pct = valid ? `${Math.round(ratio * 100)}%` : ''
  const head = r.leftover_method === 'photo_ai' ? '식후 사진' : '먹은 양'
  return pct ? `${head} ${pct}` : `${head} 반영`
}

export interface DetailFoodRow {
  key: string
  name: string
  grams: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  mark: '직접 수정' | '직접 추가' | null
}
export interface MealDetailView {
  when: string
  chips: { label: string; value: number; unit: string }[]
  kcalBefore: number | null
  kcalAfter: number
  status: string | null
  foods: DetailFoodRow[]
}

const CHIPS: [string, string, string][] = [
  ['칼로리', 'total_calories_kcal', 'kcal'], ['탄수화물', 'total_carbs_g', 'g'], ['단백질', 'total_protein_g', 'g'],
  ['지방', 'total_fat_g', 'g'], ['나트륨', 'total_sodium_mg', 'mg'], ['당류', 'total_sugar_g', 'g'],
]

export function whenLabel(r: MealRecord): string {
  const d = new Date(r.eaten_at)
  if (Number.isNaN(d.getTime())) return slotLabel(r.meal_slot)
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0')
  return `${slotLabel(r.meal_slot)} · ${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`
}

export function mealDetailView(r: MealRecord): MealDetailView {
  const act = actualSummary(r) as unknown as Record<string, unknown>
  const adjusted = isAdjusted(r) && leftoverStatusLabel(r) !== null
  const foods = (Array.isArray(r.foods) ? r.foods : []).map((f, i): DetailFoodRow => {
    const g = (f as { estimated_serving_g?: unknown }).estimated_serving_g
    return {
      key: (f as { food_item_id?: string }).food_item_id ?? String(i),
      name: f?.name_ko || `음식 ${i + 1}`,
      grams: typeof g === 'number' && Number.isFinite(g) && g > 0 ? Math.round(g) : null,
      kcal: Math.round(n(f?.calories_kcal)),
      protein: r1(f?.protein_g), carbs: r1(f?.carbs_g), fat: r1(f?.fat_g),
      mark: f?.user_edit === 'renamed' ? '직접 수정' : f?.user_edit === 'added' ? '직접 추가' : null,
    }
  })
  return {
    when: whenLabel(r),
    chips: CHIPS.map(([label, key, unit]) => ({ label, value: key === 'total_calories_kcal' ? Math.round(n(act[key])) : r1(act[key]), unit })),
    kcalBefore: adjusted ? Math.round(n((r.summary as unknown as Record<string, unknown>)?.total_calories_kcal)) : null,
    kcalAfter: Math.round(n(act.total_calories_kcal)),
    status: leftoverStatusLabel(r),
    foods,
  }
}
