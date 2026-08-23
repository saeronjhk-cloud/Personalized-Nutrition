import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  buildAdditiveList,
  describeAdi,
  describeFunction,
  describeIarc,
  describeIns,
  describeAdditiveCount,
  normalizeColor,
  toAdditiveView,
  COLOR_LABEL,
  FUNCTION_UNKNOWN,
  FUNCTION_LABEL,
  SHOW_RISK_GRADE,
  GRADE_HIDDEN_NOTICE,
} from '../additives'

/**
 * 첨가물 개별 표시 판정.
 *
 * 이 테스트가 지키는 것은 «예쁘게 나오는가»가 아니라 다음 넷이다.
 *   ① 4색 밖 등급이 화면에서 «사라지지 않는다»  (조용한 소실 = 이 저장소 최대 경계 대상)
 *   ② IARC 를 «숫자만» 내지 않는다              (2B 를 1군처럼 읽으면 과다경고)
 *   ③ `adi_type` 의 정반대 의미가 «구분된다»    (not_specified vs not_established)
 *   ④ 기능 결측이 «빈칸으로» 나가지 않는다
 *
 * fixture 는 전부 실물에서 왔다:
 *   `backends/먹선/week1_pipeline/mfras_scored_665.json` (마스터 665종)
 *   `backends/먹선/meokseon-server/src/models/productModel.js:245~` SELECT 절의 컬럼명
 */

/* 실물 행 모양 — productModel.getAdditives() 가 내는 컬럼 이름 그대로. */
const 아스파탐 = {
  additive_id: 101,
  name_ko: '아스파탐',
  name_en: 'Aspartame',
  ins_no: '951',
  category: '감미료',
  mfras_grade: 'yellow',
  mfras_total: 3.6,
  iarc_group: '2B',
  adi_type: 'numerical',
  adi_value: '40.0',      // ★ VARCHAR(50) 이라 «문자열»로 온다 (008_mfras_v2.sql:59)
  edi: '13.75',
  purposes: ['감미료'],
}

const 아질산나트륨 = {
  additive_id: 102,
  name_ko: '아질산나트륨',
  category: '보존료',
  mfras_grade: 'red',
  mfras_total: 6.6,
  iarc_group: '2A',
  adi_type: 'numerical',
  adi_value: '0.07',
  purposes: ['발색제', '보존료'],
}

const 이산화티타늄 = {
  additive_id: 103,
  name_ko: '이산화티타늄',
  category: '착색료',
  mfras_grade: 'orange',
  mfras_total: 5.7,
  iarc_group: '2B',
  adi_type: 'not_established',
  adi_value: null,
  purposes: ['착색료'],
}

const 가티검 = {
  additive_id: 104,
  name_ko: '가티검',
  category: '증점제',
  mfras_grade: 'green',
  mfras_total: 2.3,
  iarc_group: null,
  adi_type: 'not_specified',
  adi_value: null,
  purposes: ['증점제', '안정제'],
}

/* ★ 실물: 신라면 원재료명에 나오는데 category 가 비어 있다. purposes 에는 용도가 있다. */
const 리보뉴클레오티드 = {
  additive_id: 105,
  name_ko: "5'-리보뉴클레오티드이나트륨",
  category: null,
  mfras_grade: 'yellow',
  mfras_total: 3.1,
  iarc_group: null,
  adi_type: 'not_specified',
  adi_value: null,
  purposes: ['향미증진제'],
}

describe('★ ① 4색 «밖»인 첨가물이 화면에서 사라지지 않는다', () => {
  // 근거: productService.js:120 이 `mfras_grade || risk_color || 'gray'` 를 내고,
  //      mfras_grade ENUM 에는 'blue'(v1 잔재)까지 있다(000_baseline.sql:104).
  //      그런데 risk_summary.by_color 도 앱도 4색만 센다/그린다.
  it("'gray' 는 «버려지지» 않고 unknown 으로 남는다", () => {
    expect(normalizeColor('gray')).toBe('unknown')
    expect(COLOR_LABEL.unknown).toBe('등급 미상')
  })

  it("ENUM 잔재 'blue' 도 4색으로 «둔갑하지» 않는다 — unknown 이다", () => {
    // 4색 중 하나로 매핑하면 근거 없는 판정을 발명하는 것이다.
    expect(normalizeColor('blue')).toBe('unknown')
  })

  it('색이 아예 없어도(null·빈문자열) unknown 이다', () => {
    expect(normalizeColor(null)).toBe('unknown')
    expect(normalizeColor(undefined)).toBe('unknown')
    expect(normalizeColor('')).toBe('unknown')
    expect(normalizeColor('   ')).toBe('unknown')
  })

  it('4색은 그대로, 대소문자·공백은 견딘다', () => {
    expect(normalizeColor('green')).toBe('green')
    expect(normalizeColor('YELLOW')).toBe('yellow')
    expect(normalizeColor(' Orange ')).toBe('orange')
    expect(normalizeColor('red')).toBe('red')
  })

  it('★★ unknown 은 «접히지 않는다» — 펼친 목록(alerts)에 들어간다', () => {
    const v = buildAdditiveList({
      additives: [{ ...가티검 }, { name_ko: '정체불명첨가물', mfras_grade: 'gray' }],
      risk_summary: { total: 2 },
    })
    expect(v.alerts.map((a) => a.name)).toEqual(['정체불명첨가물'])
    expect(v.calm.map((a) => a.name)).toEqual(['가티검'])
  })

  it('★★ 「N종」과 목록 길이·색 합계가 어긋나지 않는다', () => {
    const v = buildAdditiveList({
      additives: [아스파탐, 아질산나트륨, { name_ko: 'X', mfras_grade: 'gray' }],
      risk_summary: { total: 3 },
    })
    const sum = Object.values(v.counts).reduce((a, b) => a + b, 0)
    expect(v.total).toBe(3)
    expect(sum).toBe(3)                    // 4색만 세면 여기서 2가 나온다 = 1종 증발
    expect(v.counts.unknown).toBe(1)
    expect(v.unlisted).toBe(0)
  })

  it('★ 서버 total 이 목록보다 크면 그 차이를 «unlisted» 로 남긴다 (침묵 금지)', () => {
    const v = buildAdditiveList({ additives: [아스파탐], risk_summary: { total: 7 } })
    expect(v.total).toBe(7)
    expect(v.unlisted).toBe(6)
  })

  it('서버 total 이 목록보다 «작아도» 그려지는 줄 수보다 적게 말하지 않는다', () => {
    const v = buildAdditiveList({ additives: [아스파탐, 가티검], risk_summary: { total: 1 } })
    expect(v.total).toBe(2)
    expect(v.unlisted).toBe(0)
  })

  it('rawColor 로 «무엇이 왔는지» 잃지 않는다 (진단용)', () => {
    expect(toAdditiveView({ name_ko: 'X', mfras_grade: 'blue' }, 0).rawColor).toBe('blue')
    expect(toAdditiveView({ name_ko: 'X' }, 0).rawColor).toBeNull()
  })
})

describe('★ ② IARC — 숫자만 내지 않는다', () => {
  it('null 이면 줄 자체를 만들지 않는다 (656/665 가 여기다 — 매번 띄우면 소음이다)', () => {
    expect(describeIarc(null)).toBeNull()
    expect(describeIarc(undefined)).toBeNull()
    expect(describeIarc('')).toBeNull()
  })

  it('3군 — 「없다」가 아니라 「분류할 수 없다」로 말한다', () => {
    const r = describeIarc('3')!
    expect(r.group).toBe('3')
    expect(r.label).toContain('분류할 수 없음')
    expect(r.note).toContain('없다»는 뜻이 아니라')
    expect(r.unmapped).toBe(false)
  })

  it('★★ 2B(아스파탐) — 1군과 «다른 칸»이라는 말이 같은 화면에 있다', () => {
    const r = describeIarc('2B')!
    expect(r.label).toContain('발암 가능성')
    expect(r.note).toContain('1군')          // 툴팁 뒤가 아니라 note 로 «항상» 나간다
    expect(r.note).not.toContain('커피')      // 커피는 2016년에 3군으로 재분류됐다 — 옛 예시 금지
  })

  it('2A — 2B 와 «다른» 문구가 나온다 (뭉치면 등급 구분이 사라진다)', () => {
    const a2 = describeIarc('2A')!
    const b2 = describeIarc('2B')!
    expect(a2.label).not.toBe(b2.label)
    expect(a2.label).toContain('가능성이 높음')
  })

  it('1군 — 근거가 «충분»하다는 것과 「얼마나 위험한가」를 구분해 말한다', () => {
    const r = describeIarc('1')!
    expect(r.label).toContain('근거 충분')
    expect(r.note).toContain('얼마나 위험한가')
  })

  it('소문자·「Group 2b」 같은 표기도 같은 등급으로 읽는다', () => {
    expect(describeIarc('2b')!.group).toBe('2B')
    expect(describeIarc('Group 2A')!.group).toBe('2A')
  })

  it('★ 모르는 등급이 와도 «사라지지 않는다» — 원문을 보여주고 unmapped 를 세운다', () => {
    const r = describeIarc('5')!
    expect(r.group).toBe('5')
    expect(r.unmapped).toBe(true)
    expect(r.label).toContain('5')
  })
})

describe('★ ③ ADI — 유형마다 의미가 «정반대»인 것을 구분한다', () => {
  it('★★ not_specified 와 not_established 는 뜻이 반대다', () => {
    const ns = describeAdi('not_specified', null)
    const ne = describeAdi('not_established', null)
    expect(ns.label).not.toBe(ne.label)
    expect(ns.note).toContain('정할 필요가 없다')     // 좋은 신호
    expect(ne.note).toContain('못한')                 // 나쁜 신호
    expect(ne.note).toContain('정반대')
  })

  it('withdrawn — 철회됐다고 말한다', () => {
    const r = describeAdi('withdrawn', null)
    expect(r.label).toContain('철회')
    expect(r.note).toContain('취소')
    expect(r.unmapped).toBe(false)
  })

  it('not_evaluated — 「안전」도 「위험」도 아니라고 명시한다', () => {
    const r = describeAdi('not_evaluated', null)
    expect(r.label).toContain('평가 이력 없음')
    expect(r.note).toContain('안전하다는 뜻도')
  })

  it('numerical + 수치 — 수치와 단위와 «의미»가 함께 나간다', () => {
    const r = describeAdi('numerical', '40.0')
    expect(r.value).toBe(40)
    expect(r.label).toBe('ADI 40 mg/kg 체중/일')
    expect(r.note).toContain('평생 매일 먹어도')
  })

  it('★ numerical 인데 수치가 없다 (마스터 665종 중 15건 실측) — 빈칸을 내지 않는다', () => {
    const r = describeAdi('numerical', null)
    expect(r.value).toBeNull()
    expect(r.label).toContain('저장돼 있지 않아요')
  })

  it('★ not_specified 인데 수치가 있다 (실측 2건) — 그 수치를 «버리지» 않는다', () => {
    const r = describeAdi('not_specified', '5')
    expect(r.value).toBe(5)
    expect(r.label).toContain('5 mg/kg')
    expect(r.note).toContain('정할 필요가 없다')  // 유형 설명도 함께 남는다
  })

  it('adi_type 자체가 없으면 「정보 없음」이라고 말한다 (안전이 아니다)', () => {
    const r = describeAdi(null, null)
    expect(r.type).toBe('missing')
    expect(r.label).toBe('ADI 정보 없음')
    expect(r.note).toContain('안전하다는 뜻은 아니에요')
  })

  it('★ limited·specified — 의미를 «확인하지 못했다»고 말하고 unmapped 를 세운다', () => {
    // 06_mfras_scoring_v2.py 의 어느 분기에도 걸리지 않는 값이다. 추측해서 안내하지 않는다.
    for (const t of ['limited', 'specified']) {
      const r = describeAdi(t, null)
      expect(r.unmapped).toBe(true)
      expect(r.label).toContain('확인 중')
    }
  })

  it('처음 보는 유형도 «사라지지 않는다» — 원문을 그대로 보여준다', () => {
    const r = describeAdi('temporary_adi', null)
    expect(r.unmapped).toBe(true)
    expect(r.label).toContain('temporary_adi')
  })

  it('숫자로 안 읽히는 문자열은 0 이 아니라 null 이다', () => {
    const r = describeAdi('numerical', 'n/a')
    expect(r.value).toBeNull()
  })
})

describe('★ ④ 기능(category) 결측 — 빈칸으로 내보내지 않는다', () => {
  it('category 가 있으면 그대로 쓴다', () => {
    expect(describeFunction(아스파탐)).toEqual({ text: '감미료', known: true, source: 'category' })
  })

  it('★ category 가 비면 purposes 로 채운다 (실측: 결측 77종 중 55종을 여기서 살린다)', () => {
    const r = describeFunction(리보뉴클레오티드)
    expect(r.text).toBe('향미증진제')
    expect(r.source).toBe('purposes')
    expect(r.known).toBe(true)
  })

  it('purposes 가 여럿이면 이어 붙인다', () => {
    expect(describeFunction({ category: null, purposes: ['증점제', '안정제'] }).text)
      .toBe('증점제 · 안정제')
  })

  it('purposes 가 PG 배열 문자열로 와도 읽는다', () => {
    expect(describeFunction({ category: '', purposes: '{"향미증진제","산도조절제"}' }).text)
      .toBe('향미증진제 · 산도조절제')
  })

  it('★★ 둘 다 없으면 빈 문자열이 아니라 「용도 정보 없음」이다', () => {
    const r = describeFunction({ category: null, purposes: null })
    expect(r.text).toBe(FUNCTION_UNKNOWN)
    expect(r.known).toBe(false)
    expect(r.source).toBe('none')
    expect(r.text).not.toBe('')
  })

  it('공백만 있는 category 는 «있는 것»으로 치지 않는다', () => {
    expect(describeFunction({ category: '   ', purposes: [] }).known).toBe(false)
  })
})

describe('★ 목록 구성 — 주황·빨강은 펼치고 초록·노랑은 접는다', () => {
  const summary = {
    additives: [가티검, 아스파탐, 이산화티타늄, 아질산나트륨, 리보뉴클레오티드],
    risk_summary: { total: 5 },
  }

  it('alerts = 빨강·주황(+등급미상), calm = 노랑·초록', () => {
    const v = buildAdditiveList(summary)
    expect(v.alerts.map((a) => a.name)).toEqual(['아질산나트륨', '이산화티타늄'])
    expect(v.calm.map((a) => a.color)).toEqual(['yellow', 'yellow', 'green'])
  })

  it('개수는 «항상» 센다 — 접혀 있어도 숫자는 나온다', () => {
    const v = buildAdditiveList(summary)
    expect(v.counts).toEqual({ green: 1, yellow: 2, orange: 1, red: 1, unknown: 0 })
  })

  it('정렬은 위해 → 주의 → 등급미상 → 허용 → 안전, 같은 색이면 점수 높은 순', () => {
    const v = buildAdditiveList({
      additives: [
        { name_ko: '낮음', mfras_grade: 'orange', mfras_total: 5.0 },
        { name_ko: '높음', mfras_grade: 'orange', mfras_total: 5.9 },
        { name_ko: '미상', mfras_grade: 'gray' },
        { name_ko: '빨강', mfras_grade: 'red', mfras_total: 6.6 },
      ],
      risk_summary: { total: 4 },
    })
    expect(v.alerts.map((a) => a.name)).toEqual(['빨강', '높음', '낮음', '미상'])
  })

  it('★ 첨가물 0종 — 빈 목록이고 개수는 전부 0 이다 (터지지 않는다)', () => {
    const v = buildAdditiveList({ additives: [], risk_summary: { total: 0 } })
    expect(v.total).toBe(0)
    expect(v.alerts).toEqual([])
    expect(v.calm).toEqual([])
    expect(v.counts).toEqual({ green: 0, yellow: 0, orange: 0, red: 0, unknown: 0 })
    expect(v.unlisted).toBe(0)
  })

  it('응답이 없거나 모양이 깨져도 터지지 않는다', () => {
    for (const bad of [null, undefined, {}, { additives: null }, { additives: 'x' } as never]) {
      const v = buildAdditiveList(bad as never)
      expect(v.total).toBe(0)
      expect(v.alerts).toEqual([])
    }
  })

  it('배열 안에 null 이 섞여도 건너뛴다', () => {
    const v = buildAdditiveList({ additives: [null, 아스파탐, undefined], risk_summary: { total: 1 } })
    expect(v.calm).toHaveLength(1)
  })

  it('이름이 없어도 줄이 사라지지 않는다 — 「이름 미상」으로 남는다', () => {
    const v = buildAdditiveList({ additives: [{ mfras_grade: 'red' }], risk_summary: { total: 1 } })
    expect(v.alerts[0].name).toBe('이름 미상')
  })

  it('additive_id 가 없어도 key 가 중복되지 않는다', () => {
    const v = buildAdditiveList({
      additives: [{ name_ko: '같은이름', mfras_grade: 'red' }, { name_ko: '같은이름', mfras_grade: 'red' }],
      risk_summary: { total: 2 },
    })
    expect(new Set(v.alerts.map((a) => a.key)).size).toBe(2)
  })

  it('점수는 문자열로 와도 숫자로 좁힌다 (PG NUMERIC 방어)', () => {
    expect(toAdditiveView({ name_ko: 'X', mfras_total: '3.60' }, 0).score).toBe(3.6)
  })
})

describe('★ 실물 계약 — 다른 엔드포인트 모양(buildMfras)이 와도 견딘다', () => {
  // GET /api/products/:barcode 의 mfras.additives 는 {name, function, color, score} 다.
  // 이 엔드포인트가 아니지만, 필드명을 하나만 믿고 짜면 조용히 전부 「이름 미상」이 된다.
  it('name/function/color/score 모양도 읽는다', () => {
    const v = toAdditiveView(
      { id: 9, name: '아스파탐', function: '감미료', color: 'yellow', score: 3.6, iarc_group: '2B', adi_type: 'numerical', adi_value: 40 },
      0,
    )
    expect(v.name).toBe('아스파탐')
    expect(v.functionText).toBe('감미료')
    expect(v.color).toBe('yellow')
    expect(v.score).toBe(3.6)
    expect(v.iarc?.group).toBe('2B')
    expect(v.adi.value).toBe(40)
  })
})


/* ══════════════════════════════════════════════════════════════════════════
 * ★★★★ 2026-08-23 세션64 외부검토 — 4색 등급 «표시» OFF
 *
 * 이 블록이 지키는 것은 「등급이 사라졌는가」가 **아니다**. 두 가지다:
 *   ① 등급이 **화면에 나가지 않는다** (플래그가 꺼져 있고, 화면이 그 플래그를 실제로 읽는다)
 *   ② 등급을 **되살릴 수 있다** (계산·목록·개수가 그대로 남아 있다)
 *
 * ⚠ `@testing-library/react` 가 없어 렌더 테스트를 세울 수 없다.
 *   ⇒ 순수함수 층은 «값»으로 단정하고, 화면 배선은 이 저장소의 기존 관례인
 *     **소스 문자열 가드**로만 지킨다(선례: `pages/__tests__/Scan_allergen_wiring.test.ts`).
 *     소스 가드는 «되돌림 방지 장치»이지 동작 증명이 아니다. 초록이라고 화면이 맞는 건 아니다.
 * ══════════════════════════════════════════════════════════════════════════ */

const HERE = dirname(fileURLToPath(import.meta.url))
/** 주석을 걷어낸 «실제 코드». 주석 안의 예시 문자열에 속지 않기 위해 필요하다. */
function codeOf(rel: string): string {
  return readFileSync(resolve(HERE, rel), 'utf8')
    // ① {/* … */} JSX 주석
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    // ② 줄 «맨 앞»에서 열리고 줄 «끝»에서 닫히는 블록 주석만 걷는다.
    //   ⚠ 줄 «중간»의 `/*` 는 건드리지 않는다. 2026-08-23 실측 사고:
    //     `accept="image/*"` 의 `/*` 가 주석 시작으로 오인돼 그 뒤 **16,449자가 통째로**
    //     사라졌고, 그 안에 이 테스트가 지키려는 코드가 들어 있었다.
    //     (같은 함정이 `pages/__tests__/Scan_allergen_wiring.test.ts` 에도 있다.)
    .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')
    // ③ 줄 주석
    .replace(/^\s*\/\/.*$/gm, '')
}
const listCode = codeOf('../../../components/AdditiveList.tsx')
const scanCode = codeOf('../../../pages/Scan.tsx')

describe('★ A1 — 4색 등급 «표시»를 끈다 (계산은 남긴다)', () => {
  it('플래그가 꺼져 있다', () => {
    expect(SHOW_RISK_GRADE).toBe(false)
  })

  it('★★ 등급 계산은 그대로 돈다 — 되살릴 수 있어야 한다', () => {
    const v = buildAdditiveList({
      additives: [가티검, 아스파탐, 이산화티타늄, 아질산나트륨],
      risk_summary: { total: 4 },
    })
    // 계산이 죽으면 재구축 후 되살릴 때 «조용히» 빈 화면이 된다.
    expect(v.counts).toEqual({ green: 1, yellow: 1, orange: 1, red: 1, unknown: 0 })
    expect(v.alerts).toHaveLength(2)
    expect(v.calm).toHaveLength(2)
    expect(v.items[0].colorLabel).toBeTruthy()
  })

  it('★★ 화면 두 곳이 «모두» 플래그로 분기한다 (한쪽만 끄면 등급이 새어 나간다)', () => {
    expect(listCode).toMatch(/SHOW_RISK_GRADE/)
    expect(scanCode).toMatch(/SHOW_RISK_GRADE/)
  })

  it('★★★ 4색 pill 과 등급 라벨이 플래그 «밖»에 남아 있지 않다', () => {
    // pill 은 PILL_COLORS.map 으로 그린다. 그 줄이 SHOW_RISK_GRADE 분기 안에 있어야 한다.
    const guarded = scanCode.split('SHOW_RISK_GRADE')
    expect(guarded[0]).not.toMatch(/PILL_COLORS\.map/)
    // 등급 라벨(colorLabel)·점수는 GradedItem(= ON 전용 컴포넌트) 안에만 있다.
    expect(listCode.split('function GradedItem')[0]).not.toMatch(/colorLabel/)
    expect(listCode.split('function GradedItem')[0]).not.toMatch(/위해성 \{item\.score\}/)
  })
})

describe('★ A1 — 등급으로 정렬하지 않는다 (순서로 판정이 새어 나가지 않게)', () => {
  /**
   * 서버 `productModel.getAdditives()` 의 ORDER BY 는 `COALESCE(a.mfras_total,0) DESC …` —
   * **위해성 점수 내림차순**이다. 등급 라벨만 지우고 이 순서를 남기면
   * 「위에 있는 게 더 위험한 것」이라는 판정이 순서로 계속 전달된다.
   * ⇒ `items` 는 이름 가나다순으로 «다시» 정렬한다.
   */
  it('★★ items 는 서버 순서(위해성 내림차순)가 아니라 이름 가나다순이다', () => {
    const v = buildAdditiveList({
      // 서버가 주는 순서를 그대로 흉내낸다: 점수 높은 것이 먼저.
      additives: [아질산나트륨, 이산화티타늄, 아스파탐, 리보뉴클레오티드, 가티검],
      risk_summary: { total: 5 },
    })
    const names = v.items.map((a) => a.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ko')))
    // 가장 위험한 것이 맨 위에 오지 «않는다» (그게 이 변경의 요지다)
    expect(names[0]).not.toBe('아질산나트륨')
  })

  it('items 는 alerts+calm 과 «같은 것»을 담는다 — 어느 것도 빠지지 않는다', () => {
    const v = buildAdditiveList({
      additives: [가티검, 아스파탐, { name_ko: '미상', mfras_grade: 'gray' }],
      risk_summary: { total: 3 },
    })
    expect(v.items).toHaveLength(3)
    expect(new Set(v.items.map((a) => a.key)))
      .toEqual(new Set([...v.alerts, ...v.calm].map((a) => a.key)))
  })

  it('이름이 같아도 정렬이 흔들리지 않는다(key 로 안정화)', () => {
    const v = buildAdditiveList({
      additives: [{ name_ko: '같은이름', mfras_grade: 'red' }, { name_ko: '같은이름', mfras_grade: 'green' }],
      risk_summary: { total: 2 },
    })
    expect(v.items.map((a) => a.key)).toEqual([...v.items.map((a) => a.key)].sort())
  })
})

describe('★ A2 — 개수 문구가 completeness 주장이 되지 않는다', () => {
  // 근거: 라벨의 첨가물 중 33.3% 가 마스터에 매칭되지 않아 목록에서 조용히 사라진다(세션64 실측).
  it('「첨가물 7종」이라고 «단정»하지 않는다', () => {
    const t = describeAdditiveCount(7)
    expect(t).toContain('현재 인식한')
    expect(t).toContain('7개')
    expect(t).not.toMatch(/^첨가물 7종$/)
  })

  it('★ 화면이 이 함수를 쓴다 — 문구를 화면에 다시 적으면 갈라진다', () => {
    expect(scanCode).toMatch(/describeAdditiveCount\(/)
  })
})

describe('★ A3 — E-number 를 화면에 내지 않는다 (INS 를 쓴다)', () => {
  /**
   * 한국 식품첨가물공전은 INS 번호를 쓰고 E-number 는 법정 표시가 아니다.
   * 유럽 실증에서 E 표기는 「자연스럽지 않다」는 인식을 높이는 것으로 나타났다.
   */
  it('ins_no → 「INS 951」', () => {
    expect(describeIns({ ins_no: '951' })).toBe('INS 951')
    expect(describeIns({ ins_no: 'INS951' })).toBe('INS 951')
    expect(describeIns({})).toBeNull()
  })

  it('★★ e_number 는 «읽지도» 않는다 — 있어도 화면 모델에 들어오지 않는다', () => {
    const v = toAdditiveView({ name_ko: '아스파탐', e_number: 'E951', ins_no: '951' }, 0)
    expect(v.ins).toBe('INS 951')
    expect(JSON.stringify(v)).not.toContain('E951')
  })

  it('★★ 컴포넌트 소스에 e_number 가 없다', () => {
    expect(listCode).not.toMatch(/e_number/)
    expect(scanCode).not.toMatch(/e_number/)
  })
})

describe('★ A4 — IARC·ADI 는 기본 줄이 아니라 «접힌 상세» 안에 있다', () => {
  /**
   * 근거: `iarc_group` 이 98.6% 비어 있다. 기본 줄에 IARC 가 뜨는 9종은
   * 그 자체로 **새로운 빨간 배지**가 된다. 삭제가 아니라 «강등»이다.
   */
  it('★★ 등급 OFF 화면(PlainItem)의 기본 줄에는 IARC 가 없다', () => {
    const plain = listCode.split('function PlainItem')[1].split('function GradedItem')[0]
    expect(plain).not.toMatch(/item\.iarc/)
    expect(plain).toMatch(/<Evidence/)
  })

  it('★★ 상세 안에서는 «수치와 설명이 같은 화면»이라는 원칙이 그대로다', () => {
    const evidence = listCode.split('function Evidence')[1].split('function PlainItem')[0]
    expect(evidence).toMatch(/item\.iarc\.label/)
    expect(evidence).toMatch(/item\.iarc\.note/)
    expect(evidence).toMatch(/item\.adi\.label/)
    expect(evidence).toMatch(/item\.adi\.note/)
  })
})

describe('★ A5·A8 — 「기능」이 아니라 「일반적 용도」, 결측은 중립 표기', () => {
  it('라벨 문구가 「일반적 용도」다', () => {
    expect(FUNCTION_LABEL).toBe('일반적 용도')
  })

  it('★★ 용도 결측은 「현재 정보 없음」이다 — 빈칸도, 경고도 아니다', () => {
    expect(FUNCTION_UNKNOWN).toBe('현재 정보 없음')
    const r = describeFunction({ category: null, purposes: null })
    expect(r.text).toBe('현재 정보 없음')
    expect(r.known).toBe(false)
  })

  it('★ 결측 줄과 있는 줄이 «같은 모양»으로 나간다 (경고색으로 칠하지 않는다)', () => {
    const plain = listCode.split('function PlainItem')[1].split('function GradedItem')[0]
    // 한 곳에서만 그린다 = 결측 전용 분기가 없다.
    expect(plain.match(/FUNCTION_LABEL/g) || []).toHaveLength(1)
    expect(plain).not.toMatch(/#ef4444|danger/)
  })
})

describe('★ A7 — 안내는 섹션 헤더에 «한 번만»', () => {
  it('문구가 무엇을 표시하지 않는지·무엇을 표시하는지 둘 다 말한다', () => {
    expect(GRADE_HIDDEN_NOTICE).toContain('표시하지 않습니다')
    expect(GRADE_HIDDEN_NOTICE).toContain('일반적 용도')
  })

  it('★ 「믿지 마세요」류 문장이 아니다', () => {
    expect(GRADE_HIDDEN_NOTICE).not.toMatch(/부정확|믿을 수 없|신뢰할 수 없|오류/)
  })

  it('★★ 행마다 붙지 않는다 — 개별 줄 컴포넌트가 이 상수를 쓰지 않는다', () => {
    expect(listCode).not.toMatch(/GRADE_HIDDEN_NOTICE/)
    expect(scanCode).toMatch(/GRADE_HIDDEN_NOTICE/)
  })
})

describe('★ A9 — IARC note 의 비대칭을 없앤다', () => {
  /**
   * 종전에는 1군 note 에만 「'얼마나 위험한가'가 아니라 '발암성이 확인됐는가'」가 있었고
   * 2A·2B·3 에는 없었다. 가장 흔한 등급에 그 문장이 없으면 사용자는 IARC 를
   * «위험의 크기»로 읽는다.
   */
  for (const g of ['2A', '2B', '3']) {
    it(`${g}군 note 가 「근거의 강도」임을 말한다`, () => {
      expect(describeIarc(g)!.note).toContain('근거의 강도')
    })
  }

  it('1군은 종전 문장을 그대로 유지한다', () => {
    expect(describeIarc('1')!.note).toContain('얼마나 위험한가')
  })

  it('★★ 기존 예시는 바뀌지 않았다 — 그리고 커피는 어디에도 없다', () => {
    expect(describeIarc('2A')!.note).toContain('붉은 고기')
    expect(describeIarc('2B')!.note).toContain('알로에베라')
    expect(describeIarc('2B')!.note).toContain('절임채소')
    for (const g of ['1', '2A', '2B', '3', '4']) {
      // 커피는 2016년에 2B → 3군으로 재분류됐다. 예시로 쓰면 문구 자체가 틀린 정보가 된다.
      expect(describeIarc(g)!.note).not.toContain('커피')
    }
  })
})
