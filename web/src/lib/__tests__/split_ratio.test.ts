import { describe, it, expect } from 'vitest'
import { splitRatio } from '../leftover_math'

describe('splitRatio (함께 먹은 인원)', () => {
  it('1. 1명 → 변화 없음', () => { expect(splitRatio(1, 1)).toBe(1); expect(splitRatio(0.8, 1)).toBe(0.8) })
  it('2. 2명 → 절반', () => { expect(splitRatio(1, 2)).toBe(0.5) })
  it('3. 먹은양×1/N + 0.01 반올림', () => { expect(splitRatio(0.8, 3)).toBe(0.27) })
  it('4. 소수 인원 → floor', () => { expect(splitRatio(1, 2.7)).toBe(0.5) })
  it('5. 0/음수/NaN 인원 → 1명 취급', () => {
    expect(splitRatio(0.9, 0)).toBe(0.9)
    expect(splitRatio(0.9, -3)).toBe(0.9)
    expect(splitRatio(0.6, NaN)).toBe(0.6)
  })
})
