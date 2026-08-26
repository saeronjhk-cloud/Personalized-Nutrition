/**
 * 「내가 보낸 제보」 — 응답 정규화·문구.
 *
 * ★★ 이 파일이 지키는 것 — 딱 둘이다.
 *   ① **없는 상태를 지어내지 않는다.** 서버 `status` 는 사람이 검토하기 전까지 `pending` 이다
 *      (`crowdsourceService.js:564` INSERT · 값을 바꾸는 곳은 관리자 라우트뿐).
 *      「검토 중」·「분석 중」처럼 자동으로 진행되는 듯 말하면 사용자는 오지 않을 변화를 기다린다.
 *      처음 보는 값은 「상태 확인 중」이다.
 *   ② **없는 것을 메우지 않는다.** 제품명이 없으면 바코드, 그것도 없으면 그렇다고 말한다.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeContribution, normalizeContributionPage,
  describeContributionStatus, describeContributionNutrition, describeContributionTitle,
  contributionBarcode, formatReportedAt,
  CONTRIBUTIONS_EMPTY, CONTRIBUTIONS_EMPTY_HINT, CONTRIBUTIONS_STATUS_HINT,
  CONTRIBUTIONS_LOAD_ERROR, CONTRIBUTIONS_ACCOUNT_NOTICE, CONTRIBUTION_NO_BARCODE_NOTE,
  CONTRIBUTIONS_TITLE,
  type MyContribution,
} from '../contributions'

const ROW = {
  contribution_id: 12,
  created_at: '2026-08-24T01:23:45.000Z',
  barcode: '8801043032155',
  product_name: '신라면 봉지면',
  status: 'pending',
  nutrition_status: 'ok',
  product_id: 501,
}

function item(over: Partial<MyContribution> = {}): MyContribution {
  return {
    id: 1, createdAt: null, barcode: null, productName: null,
    status: null, nutritionStatus: null, productId: null, ...over,
  }
}

describe('normalizeContribution', () => {
  it('서버 키를 화면용 필드로 옮긴다', () => {
    expect(normalizeContribution(ROW)).toEqual({
      id: 12,
      createdAt: '2026-08-24T01:23:45.000Z',
      barcode: '8801043032155',
      productName: '신라면 봉지면',
      status: 'pending',
      nutritionStatus: 'ok',
      productId: 501,
    })
  })

  it('★ contribution_id 가 없으면 버린다 — key 를 인덱스로 만들면 상태가 엉뚱한 줄에 붙는다', () => {
    expect(normalizeContribution({ ...ROW, contribution_id: null })).toBeNull()
    expect(normalizeContribution({ ...ROW, contribution_id: 'abc' })).toBeNull()
    expect(normalizeContribution(null)).toBeNull()
    expect(normalizeContribution('x')).toBeNull()
  })

  it('빈 문자열은 null 이다 — 「없다」와 「빈 값이 왔다」를 섞지 않는다', () => {
    const v = normalizeContribution({ ...ROW, product_name: '   ', barcode: '' })
    expect(v?.productName).toBeNull()
    expect(v?.barcode).toBeNull()
  })
})

describe('normalizeContributionPage', () => {
  it('★★ 빈 목록 — 던지지 않고 빈 페이지를 돌려준다', () => {
    const p = normalizeContributionPage({ items: [], total: 0 })
    expect(p.items).toEqual([])
    expect(p.total).toBe(0)
  })

  it('data 가 이상해도 빈 페이지다 (화면이 깨지지 않는다)', () => {
    for (const bad of [null, undefined, 42, 'x', {}, { items: 'nope' }]) {
      const p = normalizeContributionPage(bad)
      expect(p.items).toEqual([])
      expect(p.total).toBe(0)
    }
  })

  it('★ total 이 목록보다 «작으면» 목록 길이를 쓴다 (그리는 줄보다 적은 숫자가 더 나쁜 거짓말)', () => {
    const p = normalizeContributionPage({ items: [ROW, { ...ROW, contribution_id: 13 }], total: 1 })
    expect(p.items).toHaveLength(2)
    expect(p.total).toBe(2)
  })

  it('total 이 없으면 목록 길이를 쓴다', () => {
    expect(normalizeContributionPage({ items: [ROW] }).total).toBe(1)
  })

  it('깨진 행은 조용히 버리되 나머지는 살린다', () => {
    const p = normalizeContributionPage({ items: [ROW, null, { nope: 1 }], total: 3 })
    expect(p.items).toHaveLength(1)
    expect(p.total).toBe(3)
  })
})

describe('describeContributionStatus — 없는 상태를 지어내지 않는다', () => {
  it('아는 세 값만 문구를 갖는다', () => {
    expect(describeContributionStatus('pending')).toEqual({ label: '접수됨', known: true })
    expect(describeContributionStatus('approved')).toEqual({ label: '반영됨', known: true })
    expect(describeContributionStatus('rejected')).toEqual({ label: '반영되지 않음', known: true })
  })

  it('대소문자·공백을 가리지 않는다', () => {
    expect(describeContributionStatus('  PENDING ').label).toBe('접수됨')
  })

  it('★★★ 처음 보는 status 는 「상태 확인 중」 — 지어내지 않고, 침묵하지도 않는다', () => {
    for (const s of ['in_review', 'processing', '', '   ', null, undefined, 42, {}]) {
      const v = describeContributionStatus(s)
      expect(v.known).toBe(false)
      expect(v.label).toBe('상태 확인 중')
      expect(v.label.length).toBeGreaterThan(0)
    }
  })

  it('★★ 「검토 중」처럼 자동 진행을 암시하는 말을 쓰지 않는다', () => {
    // pending 은 사람이 볼 때까지 그대로다. 오지 않을 변화를 기다리게 하면 안 된다.
    expect(describeContributionStatus('pending').label).not.toMatch(/중$/)
  })
})

describe('describeContributionNutrition', () => {
  it("'ok' 만 «저장됨»이다", () => {
    expect(describeContributionNutrition('ok')).toBe('영양정보까지 저장됨')
  })

  it('★ 모르는 값은 「저장 안 됨」쪽으로 읽는다 (Render Conservative)', () => {
    expect(describeContributionNutrition('incomplete')).toBe('영양정보는 저장되지 않음')
    expect(describeContributionNutrition('partial')).toBe('영양정보는 저장되지 않음')
  })

  it('★★ 서버가 말이 없으면 «아무 말도 하지 않는다»', () => {
    expect(describeContributionNutrition(null)).toBeNull()
    expect(describeContributionNutrition(undefined)).toBeNull()
    expect(describeContributionNutrition('')).toBeNull()
    expect(describeContributionNutrition('   ')).toBeNull()
  })
})

describe('describeContributionTitle / contributionBarcode', () => {
  it('제품명 → 바코드 → 「제품명 없이 보낸 제보」 순', () => {
    expect(describeContributionTitle(item({ productName: '신라면' }))).toBe('신라면')
    expect(describeContributionTitle(item({ barcode: '8801043032155' }))).toBe('바코드 8801043032155')
    expect(describeContributionTitle(item())).toBe('제품명 없이 보낸 제보')
  })

  it('★ 바코드 «모양»이 아니면 제품 화면으로 보내지 않는다 (눌러도 아무 일 없는 버튼을 만들지 않는다)', () => {
    expect(contributionBarcode(item({ barcode: '8801043032155' }))).toBe('8801043032155')
    expect(contributionBarcode(item({ barcode: '123' }))).toBeNull()
    expect(contributionBarcode(item({ barcode: 'abcdefgh' }))).toBeNull()
    expect(contributionBarcode(item())).toBeNull()
  })
})

describe('formatReportedAt', () => {
  it('★ 「3시간 전」 같은 상대 표기를 쓰지 않는다 — 열 때마다 값이 달라진다', () => {
    const s = formatReportedAt('2026-08-24T01:23:45.000Z')
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })
  it('읽을 수 없으면 null (없는 시각을 지어내지 않는다)', () => {
    expect(formatReportedAt('나중에')).toBeNull()
    expect(formatReportedAt('')).toBeNull()
    expect(formatReportedAt(null)).toBeNull()
  })
})

describe('문구 — 안전 계약', () => {
  it('전부 비어 있지 않다', () => {
    for (const s of [
      CONTRIBUTIONS_TITLE, CONTRIBUTIONS_EMPTY, CONTRIBUTIONS_EMPTY_HINT,
      CONTRIBUTIONS_STATUS_HINT, CONTRIBUTIONS_LOAD_ERROR,
      CONTRIBUTIONS_ACCOUNT_NOTICE, CONTRIBUTION_NO_BARCODE_NOTE,
    ]) expect(s.trim().length).toBeGreaterThan(0)
  })

  it('★★ 「없다」와 「못 불러왔다」가 다른 문구다 — 섞으면 사용자는 제보가 사라졌다고 읽는다', () => {
    expect(CONTRIBUTIONS_EMPTY).not.toBe(CONTRIBUTIONS_LOAD_ERROR)
    expect(CONTRIBUTIONS_EMPTY).toMatch(/없어요/)
    expect(CONTRIBUTIONS_LOAD_ERROR).toMatch(/불러오지 못했어요/)
  })

  it('★ 상태 안내가 「사람이 확인한다」는 사실을 말한다 (시점을 약속하지 않는다)', () => {
    expect(CONTRIBUTIONS_STATUS_HINT).toMatch(/사람/)
    expect(CONTRIBUTIONS_STATUS_HINT).not.toMatch(/곧|이내|영업일/)
  })

  it('★★ 계정 기준이라는 사실을 말한다 (세션64b 의 「이 기기에만」은 더 이상 사실이 아니다)', () => {
    expect(CONTRIBUTIONS_ACCOUNT_NOTICE).toMatch(/계정/)
  })
})
