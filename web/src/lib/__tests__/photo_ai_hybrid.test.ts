import { describe, it, expect } from 'vitest'
import { buildPhotoAiHybridSuggestBody } from '../leftover_math'

describe('buildPhotoAiHybridSuggestBody (C-min)', () => {
  it('1. leftover_method=photo_ai_hybrid, 식후만 전송', () => {
    expect(buildPhotoAiHybridSuggestBody('m1', 'B64')).toEqual({
      pre_meal_log_id: 'm1', leftover_method: 'photo_ai_hybrid', after_image: 'B64', after_image_mime: 'image/jpeg',
    })
  })
  it('2. 식전 이미지 키 없음(서버가 저장분 참조)', () => {
    const b = buildPhotoAiHybridSuggestBody('m1', 'B64', 'image/png') as Record<string, unknown>
    expect('pre_image' in b).toBe(false)
    expect('pre_image_url' in b).toBe(false)
    expect(b.after_image_mime).toBe('image/png')
  })
})
