/**
 * 먹은 양 보정 당류·섬유 — Edge 배선 G1~G4 (IP/integration/leftover_sugar_fiber_eval_v1.md §G)
 * 대상: backends/NutriLens/supabase/functions/meal-leftover/index.ts (소스 검사)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const edge = readFileSync(resolve(__dirname, '../../../../backends/NutriLens/supabase/functions/meal-leftover/index.ts'), 'utf-8')
const fn = (name: string) => {
  const i = edge.indexOf(`function ${name}(`)
  expect(i).toBeGreaterThan(-1)
  return edge.slice(i, edge.indexOf('\n}\n', i))
}

describe('meal-leftover 당류·섬유', () => {
  it('G1 엔진 입력에 당류·섬유', () => {
    const f = fn('foodToEngineItem')
    expect(f).toMatch(/sugar_g: Number\(f\.sugar_g/)
    expect(f).toMatch(/fiber_g: Number\(f\.fiber_g/)
  })
  it('G2 결과 저장은 키 있을 때만', () => {
    const f = fn('engineSummaryToMealLog')
    expect(f).toMatch(/summary\.sugar_g != null \? \{ total_sugar_g: summary\.sugar_g \}/)
    expect(f).toMatch(/summary\.fiber_g != null \? \{ total_fiber_g: summary\.fiber_g \}/)
  })
  it('G3 세션 합산·스냅샷·pre 응답', () => {
    expect(fn('buildOriginalFoodsSnapshot')).toContain('sugar_g')
    expect(fn('mealLogSummaryToPre')).toContain('total_sugar_g')
    expect(edge).toMatch(/agg\.sugar \+= Number\(s\.total_sugar_g/)
    expect(edge).toMatch(/total_sugar_g: agg\.sugar/)
    expect(edge).toMatch(/sugar_g: logEngineFoods\.some/)
  })
  it('G4 기존 5개 매핑 불변', () => {
    const f = fn('engineSummaryToMealLog')
    for (const k of ['calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'sodium_mg']) expect(f).toContain(`total_${k}: summary.${k} ?? 0`)
  })
})
