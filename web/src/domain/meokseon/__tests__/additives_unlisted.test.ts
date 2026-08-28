import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  buildAdditiveList,
  readUnlisted,
  describeUnlistedAdditives,
  describeAdditiveCount,
} from '../additives'

/**
 * ★★★★ `U65-2` — 「목록에 넣지 못한 첨가물 N개」 경고. (2026-08-28 세션65)
 *
 * ── 무엇이 잘못돼 있었나 ────────────────────────────────────────────────────
 * `additives.ts` 는 `unlisted` 를 `Math.max(0, Math.max(serverTotal, items.length) - items.length)`
 * 로 «만들어 냈다». 그런데 서버 `risk_summary.total` 은 **「저장되어 조회된 개수」**라서
 * `items.length` 를 넘을 수가 없다. ⇒ `unlisted` 가 **구조적으로 항상 0**,
 * ⇒ `AdditiveList.tsx` 의 경고가 **한 번도 뜬 적이 없다.**
 *
 * 그동안 실측으로는 라벨에서 검출된 첨가물의 **66.1%**(189 중 125)가 저장 단계에서
 * 사라지고 있었고, 그 사실이 화면 어디에도 남지 않았다.
 *   근거: `backends/먹선/meokseon-server/.tmp/s65/U64-3_재측정_판정.md` §1·§4
 *
 * ── 계약 (정본: `.tmp/s65/계약_세션65.md` C2-b·C2-c) ────────────────────────
 *   서버가 내려주는 것:
 *     risk_summary.total          = 저장되어 조회된 개수            (의미 변경 없음)
 *     risk_summary.detected_total = 제보 당시 라벨에서 «검출»된 총 개수 · 모르면 null
 *     risk_summary.unlisted       = max(0, detected_total - total) · detected 가 null 이면 0
 *   앱이 하는 것:
 *     ① `unlisted` 를 **그대로** 쓴다. 빼기를 다시 하지 «않는다».
 *     ② 서버가 안 주면 **0**. ⛔ 절대 추정하지 않는다.
 *     ③ OCR 제보 직후 경로는 마스터 조인이 없어 소실도 없다 ⇒ 항상 0.
 *
 * ── 이 파일이 지키는 것 ─────────────────────────────────────────────────────
 *   ① 서버가 준 값이 «그대로» 화면 모델에 도착한다 (감쇠·재계산 금지)
 *   ② 안 주면 0 — 기존 제품(대다수 `detected_total = null`)의 화면이 **지금과 같다**
 *   ③ 앱이 다시 빼지 않는다 — `U65-2` 의 원인이 되돌아오지 못하게 «값»으로 못 박는다
 *   ④ 문구가 사실보다 세거나 약하지 않고, 원인을 «단정»하지 않는다
 *   ⑤ 화면 두 곳의 배선 (소스 가드 — 되돌림 방지 장치이지 동작 증명이 아니다)
 */

/* 실물 행 모양 — productModel.getAdditives() 가 내는 컬럼 이름 그대로. */
const 아스파탐 = { additive_id: 101, name_ko: '아스파탐', category: '감미료', mfras_grade: 'yellow' }
const 가티검 = { additive_id: 104, name_ko: '가티검', category: '증점제', mfras_grade: 'green' }

/* ══════════════════════════════════════════════════════════════════════════
 * ① 서버가 준 값을 그대로 쓴다
 * ══════════════════════════════════════════════════════════════════════════ */

describe('★ U65-2 ① 서버 risk_summary.unlisted 를 «그대로» 쓴다', () => {
  it('★★ 계약 C2-b 의 실제 예시 응답(total 7 · detected_total 11 · unlisted 4)', () => {
    const v = buildAdditiveList({
      additives: [아스파탐, 가티검],
      risk_summary: { total: 7, detected_total: 11, unlisted: 4 },
    })
    expect(v.unlisted).toBe(4)
  })

  it('★★★ 이것이 `U65-2` 의 핵심 — 목록이 «꽉 차 있어도» 경고가 뜬다', () => {
    // 종전 구현은 items.length(2) >= total(2) 이라 여기서 무조건 0 을 냈다.
    // 저장된 것이 전부 조회됐다는 것과 라벨에 그것뿐이었다는 것은 «다른 말»이다.
    const v = buildAdditiveList({
      additives: [아스파탐, 가티검],
      risk_summary: { total: 2, detected_total: 9, unlisted: 7 },
    })
    expect(v.items).toHaveLength(2)
    expect(v.unlisted).toBe(7)
  })

  it('★★ total 과 unlisted 는 «겹치지 않는다» — 부분집합이 아니다', () => {
    // detected_total(11) = total(7) + unlisted(4). 화면은 「7개」를 말하고 「4개 더」를 말한다.
    const v = buildAdditiveList({
      additives: [아스파탐, 가티검],
      risk_summary: { total: 7, detected_total: 11, unlisted: 4 },
    })
    expect(v.total + v.unlisted).toBe(11)
    // 「7개 중 4개」로 읽히면 안 된다 — 개수 문구는 total 만 말한다.
    expect(describeAdditiveCount(v.total)).toContain('7개')
  })

  it('★★ 100% 소실(저장 0 · 검출 11) 에서도 값이 살아 있다', () => {
    const v = buildAdditiveList({
      additives: [],
      risk_summary: { total: 0, detected_total: 11, unlisted: 11 },
    })
    expect(v.total).toBe(0)
    expect(v.unlisted).toBe(11)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ② 서버가 안 주면 0 — 회귀 없음
 * ══════════════════════════════════════════════════════════════════════════ */

describe('★ U65-2 ② 서버가 unlisted 를 안 주면 0 이다 (추정 금지 · 회귀 없음)', () => {
  it('★★ 구버전 응답(필드 자체가 없다) → 0', () => {
    const v = buildAdditiveList({ additives: [아스파탐, 가티검], risk_summary: { total: 2 } })
    expect(v.unlisted).toBe(0)
  })

  it('★★ detected_total 이 null 인 기존 제품(대다수) → 0. 화면이 지금과 «완전히» 같다', () => {
    const v = buildAdditiveList({
      additives: [아스파탐, 가티검],
      risk_summary: { total: 2, detected_total: null, unlisted: 0 },
    })
    expect(v.unlisted).toBe(0)
    expect(v.total).toBe(2)
    expect(v.items).toHaveLength(2)
  })

  it('risk_summary 자체가 없어도 0 이고 터지지 않는다', () => {
    expect(buildAdditiveList({ additives: [아스파탐] }).unlisted).toBe(0)
    expect(buildAdditiveList({ additives: [아스파탐], risk_summary: null }).unlisted).toBe(0)
  })

  it('응답이 깨져 있어도 0 이다', () => {
    for (const bad of [null, undefined, {}, { additives: null }, { additives: 'x' } as never]) {
      expect(buildAdditiveList(bad as never).unlisted).toBe(0)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ③ 앱은 빼기를 «다시» 하지 않는다 — U65-2 의 원인이 돌아오지 못하게
 * ══════════════════════════════════════════════════════════════════════════ */

describe('★ U65-2 ③ 앱이 total − 목록길이 로 «지어내지» 않는다', () => {
  it('★★★ total 7 · 목록 1 · unlisted 미제공 → 0 (종전 구현이면 6 이 나온다)', () => {
    const v = buildAdditiveList({ additives: [아스파탐], risk_summary: { total: 7 } })
    expect(v.unlisted).toBe(0)
  })

  it('★★ 서버가 0 이라고 «말하면» 0 이다 — total 이 아무리 커도 뒤집지 않는다', () => {
    const v = buildAdditiveList({
      additives: [아스파탐],
      risk_summary: { total: 9, detected_total: null, unlisted: 0 },
    })
    expect(v.unlisted).toBe(0)
  })

  it('★★ 서버가 준 값을 목록 길이로 «깎지» 않는다 — 목록이 더 길어도 그대로다', () => {
    const v = buildAdditiveList({
      additives: [아스파탐, 가티검],
      risk_summary: { total: 2, detected_total: 5, unlisted: 3 },
    })
    expect(v.unlisted).toBe(3)
  })

  it('★★ detected_total 만 오고 unlisted 가 없으면 «앱이 계산하지 않는다» → 0', () => {
    // 서버가 계산해 내려주는 것이 계약이다. 여기서 11-7 을 하면 계산이 두 곳으로 갈라진다.
    const v = buildAdditiveList({
      additives: [아스파탐],
      risk_summary: { total: 7, detected_total: 11 },
    })
    expect(v.unlisted).toBe(0)
  })

  it('★★★ OCR 제보 직후 경로(risk_summary 없음)는 «항상» 0 이다 (계약 C2-c ③)', () => {
    // Scan.tsx: buildAdditiveList({ additives: analysis.additives })
    // 이 경로는 마스터 조인을 하지 않으므로 소실이 없다. 경고가 뜨면 그것이 오경고다.
    const v = buildAdditiveList({ additives: [아스파탐, 가티검, { name_ko: '구연산' }] })
    expect(v.total).toBe(3)
    expect(v.unlisted).toBe(0)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ④ 값 좁히기 — 화면에 「-1개」·「3.5개」를 내지 않는다
 * ══════════════════════════════════════════════════════════════════════════ */

describe('★ U65-2 ④ readUnlisted — 이상한 값을 화면까지 흘리지 않는다', () => {
  it('정상 정수는 그대로', () => {
    expect(readUnlisted({ risk_summary: { unlisted: 4 } })).toBe(4)
  })

  it('문자열로 와도 읽는다 (PG 드라이버가 숫자를 문자열로 주는 사례가 이 저장소에 있다)', () => {
    expect(readUnlisted({ risk_summary: { unlisted: '4' } })).toBe(4)
  })

  it('★ 음수·0 은 0 이다 — 화면에 「-1개」를 내지 않는다', () => {
    expect(readUnlisted({ risk_summary: { unlisted: -1 } })).toBe(0)
    expect(readUnlisted({ risk_summary: { unlisted: 0 } })).toBe(0)
  })

  it('★ 소수는 내림한다 — 「3.7개」라고 말하지 않는다', () => {
    expect(readUnlisted({ risk_summary: { unlisted: 3.7 } })).toBe(3)
  })

  it('숫자로 안 읽히는 값·null·undefined 는 0 이다', () => {
    expect(readUnlisted({ risk_summary: { unlisted: 'n/a' } })).toBe(0)
    expect(readUnlisted({ risk_summary: { unlisted: null } })).toBe(0)
    expect(readUnlisted({ risk_summary: { unlisted: undefined } })).toBe(0)
    expect(readUnlisted({ risk_summary: { unlisted: NaN } })).toBe(0)
    expect(readUnlisted(null)).toBe(0)
    expect(readUnlisted(undefined)).toBe(0)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ⑤ 문구 — 사실보다 세지도 약하지도 않게, 원인은 «단정하지 않게»
 * ══════════════════════════════════════════════════════════════════════════ */

describe('★ U65-2 ⑤ 경고 문구', () => {
  const t = describeUnlistedAdditives(4)

  it('개수를 말한다 — 그리고 「종」이 아니라 「개」다 (섹션 단위 통일)', () => {
    expect(t).toContain('4개')
    expect(t).not.toContain('종')
  })

  it('★★ 「더 있어요」 — total 안의 일부가 아니라 «별개»라는 것이 문장에 있다', () => {
    // 종전 문구 「N종은 상세 정보를 불러오지 못했어요」는 N 이 total 안의 일부라는 전제였다.
    // 계약 C2-b 이후 detected_total = total + unlisted 이므로 그 전제가 틀렸다.
    expect(t).toContain('더 있어요')
  })

  it('★★ 「상세 정보를 불러오지 못했」이라고 말하지 않는다 (일시적 로딩 실패가 아니다)', () => {
    expect(t).not.toContain('상세 정보')
    expect(t).not.toContain('불러오지')
  })

  it('★★★ 원인을 «단정하지» 않는다 — 「대조표에 없어서」는 실측상 틀린 문장이다', () => {
    // U64-3 §2: 사라진 125건 중 72% 는 마스터에 «이미 있는데도» 사라졌다.
    // 원인은 사전 결손이 아니라 저장 경로의 구조 결함이다.
    expect(t).not.toContain('대조표')
    expect(t).not.toContain('마스터')
    expect(t).not.toMatch(/때문|없어서|없기 때문/)
  })

  it('★★ 「모름」을 「안전」으로 바꾸지 않는다', () => {
    expect(t).not.toContain('안전')
    expect(t).not.toMatch(/문제 없|괜찮|걱정/)
  })

  it('★★ 완전성을 실제보다 크게 주장하지 않는다 — 「전부」라고 단정하지 않는다', () => {
    expect(t).not.toMatch(/전부입니다|전부예요|모두 보여/)
  })

  it('★ 문체 — 해요체다. 이 섹션의 합니다체는 안내문 쪽 한 곳뿐이다', () => {
    expect(t).not.toMatch(/습니다|합니다|입니다/)
    for (const s of t.split('.').map((x) => x.trim()).filter(Boolean)) {
      expect(s.endsWith('요')).toBe(true)
    }
  })

  it('개수가 1 이어도 문장이 깨지지 않는다', () => {
    expect(describeUnlistedAdditives(1)).toContain('1개')
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ⑥ 화면 배선 — 소스 가드
 *
 * ⚠ `@testing-library/react` 가 없어 렌더 테스트를 세울 수 없다.
 *   이 저장소의 기존 관례대로 «소스 문자열 가드»로 되돌림만 막는다
 *   (선례: `additives.test.ts` A1 블록 · `pages/__tests__/Scan_allergen_wiring.test.ts`).
 *   소스 가드는 되돌림 방지 장치이지 동작 증명이 아니다. 초록이라고 화면이 맞는 건 아니다.
 * ══════════════════════════════════════════════════════════════════════════ */

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * 주석을 걷어낸 «실제 코드». 주석 안의 예시 문자열에 속지 않기 위해 필요하다.
 *
 * ⛔ **이 함수를 「단순화」하지 말 것.** 블록 주석을 통째로 걷으면
 *   `accept="image/*"` 의 `/*` 가 주석 시작으로 오인돼 그 뒤 **16,449자가 통째로** 사라진다.
 *   2026-08-23 에 실제로 그런 상태였고, 그동안 이 종류의 테스트는 «눈이 멀어» 있었다.
 *   ⇒ 줄 «맨 앞»에서 열리고 줄 «끝»에서 닫히는 블록 주석만 걷는다.
 */
function codeOf(rel: string): string {
  return readFileSync(resolve(HERE, rel), 'utf8')
    // ① {/* … */} JSX 주석
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    // ② 줄 맨 앞에서 열리고 줄 끝에서 닫히는 블록 주석만 (줄 중간의 `/*` 는 건드리지 않는다)
    .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')
    // ③ 줄 주석
    .replace(/^\s*\/\/.*$/gm, '')
}

const domainCode = codeOf('../additives.ts')
const listCode = codeOf('../../../components/AdditiveList.tsx')
const scanCode = codeOf('../../../pages/Scan.tsx')

describe('★ U65-2 ⑥ 배선 — 판정도 문구도 «한 곳»에만 있다', () => {
  it('★★★ 스트리퍼가 눈이 멀지 않았다 (16,449자 사고 재발 방지)', () => {
    // 걷어낸 뒤에도 각 파일의 «본문»이 남아 있어야 한다. 통째로 사라지면 아래 가드가 전부 무의미해진다.
    expect(domainCode).toMatch(/export function buildAdditiveList/)
    expect(listCode).toMatch(/export default function AdditiveList/)
    expect(scanCode).toMatch(/buildAdditiveList\(/)
    expect(scanCode.length).toBeGreaterThan(20000)
  })

  it('★★★ 앱이 unlisted 를 «다시 계산»하지 않는다 (U65-2 원인 되돌림 방지)', () => {
    expect(domainCode).toMatch(/unlisted:\s*readUnlisted\(summary\)/)
    // 종전 코드: `unlisted: Math.max(0, total - items.length)`
    expect(domainCode).not.toMatch(/unlisted:\s*Math\.max/)
    expect(domainCode).not.toMatch(/total\s*-\s*items\.length/)
  })

  it('★★ 앱이 detected_total 로 빼기를 하지 않는다 (계산이 두 곳으로 갈라지면 안 된다)', () => {
    expect(domainCode).not.toMatch(/detected_total\s*[-–]/)
    expect(domainCode).not.toMatch(/detectedTotal/)
  })

  it('★★ 경고 문구의 정본은 domain 한 곳이다 — 화면이 다시 적지 않는다', () => {
    expect(listCode).toMatch(/describeUnlistedAdditives\(view\.unlisted\)/)
    expect(listCode).not.toContain('상세 정보를 불러오지 못했')
    expect(listCode).not.toContain('전부가 아니에요')
  })

  it('★★★ unlisted 만 있고 목록이 비어도 컴포넌트가 «사라지지» 않는다', () => {
    // `if (view.total === 0) return null` 하나였을 때는 100% 소실에서 경고까지 함께 사라졌다.
    expect(listCode).toMatch(/view\.total === 0 && view\.unlisted === 0/)
    expect(listCode).not.toMatch(/if \(view\.total === 0\) return null/)
  })

  it('★★★ 바코드 화면도 100% 소실에서 「없어요」 한 줄로 끝내지 않는다', () => {
    expect(scanCode).toMatch(/additiveView\.total === 0 && additiveView\.unlisted === 0/)
  })

  it('★★ OCR 제보 직후 경로는 risk_summary 를 «지어내지» 않는다 (항상 unlisted 0)', () => {
    expect(scanCode).toMatch(/buildAdditiveList\(\{\s*additives:\s*analysis\.additives\s*\}\)/)
  })
})
