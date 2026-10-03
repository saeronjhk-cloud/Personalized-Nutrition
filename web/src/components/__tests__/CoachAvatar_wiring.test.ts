/**
 * 서박사 코칭 캐릭터 — 식사 기록 화면 배선 (IP/character/서박사_캐릭터풀_v1.md §8)
 *  K1 18종 파일이 public/coach 에 모두 있고 COACH_POSES 와 1:1
 *  K2 화면별 포즈: 분석 중 D2 · 오류 E2 · 저장 완료 A1(사진·가공식품·②카드) · 먹은 양 반영 완료 A2
 *  K3 장식 이미지(alt="" · aria-hidden) — 문구는 텍스트가 전달
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { COACH_POSES, coachSrc } from '../CoachAvatar'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')

describe('코칭 캐릭터 배선', () => {
  it('K1 18종 파일 존재 · 목록 1:1', () => {
    const files = readdirSync(resolve(__dirname, '../../../public/coach')).filter((f) => f.endsWith('.webp')).sort()
    expect(files.length).toBe(18)
    expect(files).toEqual(COACH_POSES.map((p) => coachSrc(p).replace('/coach/', '')).sort())
  })
  it('K2 화면별 포즈', () => {
    const meal = read('../../pages/Meal.tsx')
    expect(meal).toContain('<CoachAvatar pose="d2_magnifier"')
    expect(meal).toContain('<CoachAvatar pose="e2_sorry"')
    expect(read('../MealResult.tsx')).toContain('<CoachAvatar pose="a1_thumbs"')
    expect(read('../ProductMealCard.tsx')).toContain('<CoachAvatar pose="a1_thumbs"')
    const after = read('../AfterSaveLeftover.tsx')
    expect(after).toContain('<CoachAvatar pose="a1_thumbs"')
    expect(after).toContain('<CoachAvatar pose="a2_clap"')
  })
  it('K3 장식 이미지', () => {
    const c = read('../CoachAvatar.tsx')
    expect(c).toContain('alt=""')
    expect(c).toContain('aria-hidden="true"')
  })
})
