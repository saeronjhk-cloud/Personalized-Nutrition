/**
 * 먹선 화면 — 서박사 코칭 캐릭터 배선 (세션75 · 요청 IP/요청_웹앱트랙→먹선_서박사캐릭터_화면배치_2026-10-03.md)
 * 매핑 정본: backends/먹선/IP/설계_먹선_서박사캐릭터배치_v1_2026-10-03.md
 *
 *  M1 바코드 조회·검색 중        d2_magnifier (loading)
 *  M2 사진 읽는 중               d2_magnifier (reportBusy === 'analyze')
 *  M3 조회·카메라 오류(error)     e2_sorry
 *  M4 미등록 바코드(notFound)     b4_think — 웃는 얼굴 금지
 *  M5 제보 저장(서버 saved)       a2_clap — outcome.kind === 'saved' 일 때만(거짓 확인 금지)
 *  M6 제보 반려(서버 rejected)    e2_sorry
 *  M7 내 기준: 주의 항목 있음      c2_advice ≤48 · 문구 «아래»
 *  M8 내 기준: 전부 판정·주의 0    a1_thumbs ≤48 · 회색 섞이면 금지(!personal.hasUnknown 분기 안)
 *  M9 내 기준: 판정 부족           b4_think ≤48
 *  M10 내 제보 목록              d1_clipboard
 *  P2 알레르기 카드(AllergenCard) 안·바로 옆에 캐릭터 0
 *  P3 이미지는 CoachAvatar 로만(경로 직접 쓰기·새 이미지 금지)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')
const scan = read('../Scan.tsx')
const reports = read('../MyReports.tsx')
const allergenCard = read('../../components/AllergenCard.tsx')

/** `<CoachAvatar pose="X"` 가 처음 나오는 위치 앞 n 글자 */
function before(src: string, pose: string, n = 400): string {
  const i = src.indexOf(`<CoachAvatar pose="${pose}"`)
  expect(i, `${pose} 배치 없음`).toBeGreaterThan(0)
  return src.slice(Math.max(0, i - n), i)
}
function tagOf(src: string, pose: string): string {
  const i = src.indexOf(`<CoachAvatar pose="${pose}"`)
  return src.slice(i, src.indexOf('/>', i) + 2)
}
const count = (src: string, s: string) => src.split(s).length - 1
/** 해당 포즈가 나오는 «모든» 자리의 앞 n 글자 */
function prefixes(src: string, pose: string, n: number): string[] {
  const out: string[] = []
  const tag = `<CoachAvatar pose="${pose}"`
  for (let i = src.indexOf(tag); i >= 0; i = src.indexOf(tag, i + 1)) out.push(src.slice(Math.max(0, i - n), i))
  expect(out.length, `${pose} 배치 없음`).toBeGreaterThan(0)
  return out
}

describe('먹선 화면 — 서박사 캐릭터 배선', () => {
  it('import 는 공통 컴포넌트 하나', () => {
    expect(scan).toContain("import CoachAvatar from '../components/CoachAvatar'")
    expect(reports).toContain("import CoachAvatar from '../components/CoachAvatar'")
  })
  it('M1·M2 분석 중 d2_magnifier', () => {
    expect(count(scan, '<CoachAvatar pose="d2_magnifier"')).toBe(2)
    const ctx = prefixes(scan, 'd2_magnifier', 300)
    expect(ctx.some((c) => /\{loading && \(/.test(c))).toBe(true)
    expect(ctx.some((c) => c.includes("reportBusy === 'analyze'"))).toBe(true)
  })
  it('M3 오류 e2_sorry — error 카드 안', () => {
    expect(prefixes(scan, 'e2_sorry', 200).some((c) => c.includes('{error && '))).toBe(true)
  })
  it('M4 미등록 b4_think — notFound 카드, 웃는 얼굴 없음', () => {
    const i = scan.indexOf('{notFound && (')
    const block = scan.slice(i, scan.indexOf('{searchResults && (', i))
    expect(block).toContain('<CoachAvatar pose="b4_think"')
    expect(block).not.toMatch(/pose="a[1-4]_/)
  })
  it('M5·M6 제보 결과 — 박수는 서버 saved 일 때만 · 반려는 e2', () => {
    const i = scan.indexOf('if (confirmed && analysis)')
    const block = scan.slice(i, scan.indexOf('CONTRIBUTIONS_TITLE} 보기', i))
    expect(block).toMatch(/outcome\.kind === 'saved' && <CoachAvatar pose="a2_clap"/)
    expect(block).toMatch(/outcome\.kind === 'rejected' && <CoachAvatar pose="e2_sorry"/)
    expect(count(scan, 'pose="a2_clap"')).toBe(1)
  })
  it('M7~M9 내 기준으로 보기 — 크기 ≤48 · 회색엔 엄지척 금지', () => {
    for (const p of ['c2_advice', 'a1_thumbs']) {
      const m = tagOf(scan, p).match(/size=\{(\d+)\}/)
      expect(m, `${p} size 명시`).not.toBeNull()
      expect(Number(m![1])).toBeLessThanOrEqual(48)
    }
    expect(count(scan, 'pose="a1_thumbs"')).toBe(1)
    expect(before(scan, 'a1_thumbs', 300)).toContain('!personal.hasUnknown')
    // 주의 항목 목록(</ul>) «뒤»에 온다 — 문구를 밀어내지 않는다
    const ul = scan.indexOf('{personal.warnings.map(')
    expect(scan.indexOf('<CoachAvatar pose="c2_advice"')).toBeGreaterThan(scan.indexOf('</ul>', ul))
    const b4 = scan.lastIndexOf('<CoachAvatar pose="b4_think"')
    expect(scan.slice(b4, b4 + 600)).toContain('판정하기 어려워요')
  })
  it('M10 내 제보 목록 d1_clipboard', () => {
    expect(reports).toContain('<CoachAvatar pose="d1_clipboard"')
  })
  it('P2 알레르기 카드 안·바로 옆에 캐릭터 없음', () => {
    expect(allergenCard).not.toContain('CoachAvatar')
    let k = scan.indexOf('<AllergenCard')
    expect(k).toBeGreaterThan(0)
    while (k >= 0) {
      const near = scan.slice(Math.max(0, k - 250), k + 250)
      expect(near).not.toContain('<CoachAvatar')
      k = scan.indexOf('<AllergenCard', k + 1)
    }
  })
  it('P3 이미지 경로 직접 사용 금지 · 모든 캐릭터 ≤72', () => {
    for (const s of [scan, reports]) {
      expect(s).not.toMatch(/\/coach\/coach_/)
      for (const m of s.matchAll(/<CoachAvatar pose="[a-z0-9_]+"([^/]*)\/>/g)) {
        const sz = m[1].match(/size=\{(\d+)\}/)
        expect(sz ? Number(sz[1]) : 72).toBeLessThanOrEqual(72)
      }
    }
  })
})
