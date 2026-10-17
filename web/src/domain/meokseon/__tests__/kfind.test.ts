// ★ 세션80 결정 80-1 — K-FIND 품목 표시 규칙. 정답(구현 전 고정): backends/먹선/IP/eval_kfind_expose_v1/cases_v1.json = fixtures/kfind_expose_v1.json
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { kfindNotice, kfindSupplementView, isNoBarcodeItem, KFIND_BADGE, KFIND_WARNING, KFIND_SOURCE_LABEL, KFIND_SUPPLEMENT_BADGE } from '../kfind'
import type { MsKfindBlock } from '../../../lib/meokseon'

const HERE = dirname(fileURLToPath(import.meta.url))
const W = (JSON.parse(readFileSync(resolve(HERE, 'fixtures/kfind_expose_v1.json'), 'utf8')) as { wording: Record<string, string> }).wording
const code = (rel: string) => readFileSync(resolve(HERE, rel), 'utf8')
const blk = (o: Partial<MsKfindBlock> = {}): MsKfindBlock => ({ source: 'kfind', food_cd: 'P101-104000100-1203', badge: W.badge, warning: W.warning, source_label: W.source_label, release_label: '2026.09.29 기준', is_imported: false, origin_country: null, importer: null, maker: '(주)페어베이커리', report_no: '2024041736623', basis: 'per_100g', food_weight: '100g', serving_ref: '30g', nutrition_ok: true, ...o })

describe('문구 정본 = 정답 셋 wording = 서버 상수', () => {
  it('웹 기본값이 정답 문구와 같다', () => {
    expect(KFIND_BADGE).toBe(W.badge); expect(KFIND_WARNING).toBe(W.warning); expect(KFIND_SOURCE_LABEL).toBe(W.source_label); expect(KFIND_SUPPLEMENT_BADGE).toBe(W.supplement_badge)
  })
  // 서버 저장소는 별도 git 이라 웹 단독 체크아웃(CI)에는 없을 수 있다 — 있을 때만 대조(정답 셋 wording 이 양쪽의 공통 기준).
  const SVC = resolve(HERE, '../../../../../backends/먹선/meokseon-server/src/services/productService.js')
  it.runIf(existsSync(SVC))('서버 productService 상수도 같은 문구(로컬 저장소 배치일 때)', () => {
    const svc = readFileSync(SVC, 'utf8')
    for (const v of [W.badge, W.warning, W.source_label, W.supplement_badge]) expect(svc).toContain(`'${v}'`)
  })
})

describe('kfindNotice (R7)', () => {
  it('kfind 없음 → null', () => { expect(kfindNotice({})).toBeNull(); expect(kfindNotice(null)).toBeNull() })
  it('국내 품목 — 배지·경고·출처(기준일)', () => {
    expect(kfindNotice({ kfind: blk() })).toEqual({ badgeLine: W.badge, warning: W.warning, sourceLine: `${W.source_label} (2026.09.29 기준)`, originLine: null, nutritionOff: false })
  })
  it('수입 품목 — 원산지·수입업체 줄', () => {
    expect(kfindNotice({ kfind: blk({ is_imported: true, origin_country: '호주', importer: '드링크어웨이크' }) })!.originLine).toBe('수입 · 호주 · 수입 드링크어웨이크')
  })
  it('nutrition_ok=false → 신호등 꺼짐 고지 · 기준일 없음 → 출처만', () => {
    const n = kfindNotice({ kfind: blk({ nutrition_ok: false, release_label: null }) })!
    expect(n.nutritionOff).toBe(true); expect(n.sourceLine).toBe(W.source_label)
  })
})

describe('kfindSupplementView (R8)', () => {
  const sup = (nutrition: Record<string, number | null | string>) => ({ web_label: { kfind_supplement: { badge: W.supplement_badge, source_label: W.source_label, release_label: '2026.09.29 기준', food_cd: 'P1', nutrition } } } as never)
  it('보충 없음 → null', () => { expect(kfindSupplementView({})).toBeNull(); expect(kfindSupplementView({ web_label: { kfind_supplement: null } } as never)).toBeNull() })
  it('값 있는 행만(0 은 있음) · 기준', () => {
    const v = kfindSupplementView(sup({ calories: 457, sodium: 0, protein: 7, total_fat: null, basis: 'per_100g' }))!
    expect(v.rows.map((r) => r.label)).toEqual(['열량', '나트륨', '단백질']); expect(v.basisLabel).toBe('100g당'); expect(v.title).toBe(W.supplement_badge); expect(v.sourceLine).toBe(`${W.source_label} (2026.09.29 기준)`)
  })
  it('값이 하나도 없으면 null', () => { expect(kfindSupplementView(sup({ calories: null, basis: 'per_100g' }))).toBeNull() })
})

describe('화면 배선', () => {
  it('isNoBarcodeItem', () => { expect(isNoBarcodeItem({ kfind: blk() })).toBe(true); expect(isNoBarcodeItem({})).toBe(false) })
  it('Scan 이 K-FIND 결과·고지·보충을 그리고 제보/결손 경로를 isNoBarcodeItem 으로 닫는다', () => {
    const s = code('../../../pages/Scan.tsx')
    expect(s).toMatch(/data-testid="kfind-results"/); expect(s).toMatch(/kfindNotice\(result\)/); expect(s).toMatch(/kfindSupplementView\(result\)/)
    expect((s.match(/!isNoBarcodeItem\(result\) && completeness/g) || []).length).toBe(2)
    expect(s).not.toMatch(/!result\.web_label && completeness/)
  })
})
