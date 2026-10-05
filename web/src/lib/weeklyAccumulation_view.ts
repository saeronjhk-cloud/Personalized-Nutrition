/**
 * 주간 리포트 누적 v1 — 순수 뷰 로직 (설계 IP/integration/weekly_accumulation_design_v1.md D5·D6 · 평가 V1~V7)
 * 숫자는 엔진(report_weekly.accumulation)이 계산한 값만 쓴다(원칙 5). 여기서는 문구·숨김 판단·첨가물 이름 모으기만.
 * ⚠ 첨가물 위험 등급·색·점수는 쓰지 않는다(SHOW_RISK_GRADE=false 동안). 문구 상수는 domain/meokseon/additives.ts 재사용.
 */
import {
  buildAdditiveList, describeUnlistedAdditives, GRADE_HIDDEN_NOTICE, ADDITIVE_COUNT_CAVEAT,
  type AdditiveSummaryLike,
} from '../domain/meokseon/additives'

export interface AccNutrient {
  week_total: number; daily_avg: number; ref: number | null
  days_over: number; days_logged: number; unknown_foods: number
}
export interface AccProduct { barcode: string; name: string; count: number }
export interface AccProcessed {
  product_items: number; distinct_products: number; products: AccProduct[]
  sodium_share_pct: number | null; sugar_share_pct: number | null; share_excluded_meals: number
}
export interface Accumulation { sodium: AccNutrient; sugar: AccNutrient; processed: AccProcessed }

export interface AccRowView {
  key: 'sodium' | 'sugar'
  label: string
  avgText: string
  overText: string
  shareText: string | null
  unknownNote: string | null
}
export interface AccView {
  rows: AccRowView[]
  excludedNote: string | null
  products: { show: boolean; items: { name: string; countText: string }[]; moreText: string | null }
}

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR')

function row(key: 'sodium' | 'sugar', a: AccNutrient | undefined, share: number | null | undefined): AccRowView | null {
  if (!a || typeof a.daily_avg !== 'number') return null
  const unit = key === 'sodium' ? 'mg' : 'g'
  return {
    key,
    label: key === 'sodium' ? '나트륨' : '당류',
    avgText: `일평균 ${fmt(a.daily_avg)}${unit}${a.ref != null ? ` · 기준 ${fmt(a.ref)}${unit}` : ''}`,
    overText: `기준을 넘은 날 ${a.days_over}일 (기록 ${a.days_logged}일 중)`,
    shareText: typeof share === 'number' ? `가공식품에서 온 몫 ${Math.round(share)}%` : null,
    unknownNote: a.unknown_foods > 0
      ? `영양 정보가 없는 음식 ${a.unknown_foods}개는 합계에서 빠졌어요. 실제로는 이보다 많을 수 있어요.`
      : null,
  }
}

/** 엔진 report → 누적 섹션 뷰. accumulation 이 없으면(옛 엔진) null → 섹션 숨김(V1). */
export function accumulationView(report: { accumulation?: Accumulation | null } | null | undefined): AccView | null {
  const acc = report?.accumulation
  if (!acc || !acc.sodium || !acc.sugar) return null
  const p = acc.processed
  const rows = [row('sodium', acc.sodium, p?.sodium_share_pct), row('sugar', acc.sugar, p?.sugar_share_pct)]
    .filter((r): r is AccRowView => r !== null)
  const items = (p?.products ?? []).map((x) => ({ name: x.name, countText: `${x.count}번` }))
  const more = p ? p.distinct_products - items.length : 0
  return {
    rows,
    excludedNote: p && p.share_excluded_meals > 0
      ? `음식마다 드신 양을 따로 고친 끼니 ${p.share_excluded_meals}개는 가공식품 몫 계산에서 뺐어요.`
      : null,
    products: {
      show: !!p && p.product_items > 0,
      items,
      moreText: more > 0 ? `외 ${more}개 제품` : null,
    },
  }
}

// ── 첨가물 모으기 (V5~V7) ─────────────────────────────────────────
export const WEEKLY_ADDITIVE_TITLE = '이번 주 드신 가공식품에서 인식한 첨가물'
/**
 * 등급 비표시 안내 — GRADE_HIDDEN_NOTICE 의 «첫 문장만». 둘째 문장(«아래는 … 일반적 용도입니다»)은
 * 이 화면엔 용도가 없어서 사실과 어긋나므로 쓰지 않는다. 원문이 바뀌면 테스트가 알려준다.
 */
export const WEEKLY_GRADE_NOTICE = GRADE_HIDDEN_NOTICE.split('. ')[0] + '.'
export { ADDITIVE_COUNT_CAVEAT }

export interface WeeklyAdditiveInput { barcode: string; summary: AdditiveSummaryLike | null }
export interface WeeklyAdditivesView {
  names: { name: string; productCount: number }[]
  failedNote: string | null
  unlistedNote: string | null
}

/** 바코드별 먹선 /additives 결과 → 이름 가나다순(같은 이름은 «몇 개 제품에 있었나»). 등급은 읽지 않는다. */
export function aggregateWeeklyAdditives(inputs: WeeklyAdditiveInput[]): WeeklyAdditivesView {
  const per = new Map<string, Set<string>>()
  let failed = 0
  let unlisted = 0
  for (const it of inputs) {
    if (!it.summary) { failed++; continue }
    const list = buildAdditiveList(it.summary)
    unlisted += list.unlisted
    for (const a of list.items) {
      const name = (a.name || '').trim()
      if (!name) continue
      if (!per.has(name)) per.set(name, new Set())
      per.get(name)!.add(it.barcode)
    }
  }
  const names = [...per.entries()]
    .map(([name, set]) => ({ name, productCount: set.size }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return {
    names,
    failedNote: failed > 0 ? `${failed}개 제품은 첨가물 정보를 불러오지 못했어요.` : null,
    unlistedNote: unlisted > 0 ? describeUnlistedAdditives(unlisted) : null,
  }
}
