import { describe, it, expect } from 'vitest'
import { foodItemId, buildPerFoodBody } from '../leftover_math'

describe('foodItemId', () => {
  it('1. 저장된 food_item_id 사용', () => {
    expect(foodItemId({ food_item_id: 'abc' }, 0)).toBe('abc')
  })
  it('2. 없으면 인덱스(food_01..) + 패딩', () => {
    expect(foodItemId({}, 0)).toBe('food_01')
    expect(foodItemId(null, 1)).toBe('food_02')
    expect(foodItemId({}, 9)).toBe('food_10')
  })
  it('3. 공백-only id → 폴백', () => {
    expect(foodItemId({ food_item_id: '   ' }, 2)).toBe('food_03')
  })
})

describe('buildPerFoodBody', () => {
  it('4. 계약 형태 + 비율 클램프', () => {
    const b = buildPerFoodBody('m1', [
      { food_item_id: 'food_01', eaten_ratio: 1.0 },
      { food_item_id: 'food_02', eaten_ratio: 0.5 },
    ])
    expect(b).toEqual({
      pre_meal_log_id: 'm1',
      leftover_method: 'slider',
      per_food: [
        { food_item_id: 'food_01', eaten_ratio: 1 },
        { food_item_id: 'food_02', eaten_ratio: 0.5 },
      ],
    })
  })
  it('5. 범위초과 클램프', () => {
    const b = buildPerFoodBody('m1', [{ food_item_id: 'food_01', eaten_ratio: 1.5 }])
    expect(b.per_food[0].eaten_ratio).toBe(1)
  })
  it('6. pre_summary/eaten_ratio(전역) 미포함', () => {
    const b = buildPerFoodBody('m1', [{ food_item_id: 'food_01', eaten_ratio: 0.3 }]) as Record<string, unknown>
    expect('pre_summary' in b).toBe(false)
    expect('eaten_ratio' in b).toBe(false)
  })
})
