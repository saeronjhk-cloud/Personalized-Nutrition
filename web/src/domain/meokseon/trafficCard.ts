/**
 * ★ 세션82 — 웹 스캔 «먹선 영양 신호등» 카드(순수 함수 · 문구 정본).
 *   제이 10-19 «새로 넣어». 정답 IP/meokseon/eval_traffic_card_v1/cases_v1.json = __tests__/fixtures/traffic_card_v1.json
 *   ⚠ 색은 서버 traffic_light 그대로(웹 판정 없음 · R1). 색 단독 금지 — 텍스트·모양 병기(R4).
 *   ⚠ 서버 context_messages 는 화이트리스트만(R6) — 발효·견과 «건강 유익/건강한 지방»은 단정 표현 가드레일과 충돌.
 */
import type { MsTrafficLight } from '../../lib/meokseon'

export const TC_TITLE = '먹선 영양 신호등'
export const TC_FOOTER = '영양소마다 따로 판정해요(종합 점수 아님) · KDRI·식약처 표시 기준 · 진단이 아닌 생활관리 참고예요.'
export const TC_MISSING_NOTE = '«정보 없음»은 값이 없어 판정하지 않은 항목이에요. 들어 있지 않다는 뜻이 아니에요.'
export const TC_EXCLUDED: Record<string, string> = {
  alcohol: '주류는 영양 신호등 평가 대상이 아니에요.',
  supplement: '건강기능식품은 별도 기준이 적용돼 영양 신호등을 표시하지 않아요.',
  raw_ingredient: '원료 식품(미가공)은 영양 신호등 평가 대상이 아니에요.',
  _other: '이 제품은 영양 신호등 평가 대상이 아니에요.',
}
export const TC_WITHHELD_DEFAULT = '라벨의 영양성분 기준을 확정하지 못해 판정을 보류했어요.'
const CONTEXT_WHITELIST = ['건조식품으로']

type Tone = 'red' | 'yellow' | 'green' | 'gray' | 'none'
export interface TrafficRow { key: string; label: string; text: string; shape: string; detail: string; tone: Tone }
export interface TrafficCardView { mode: 'normal' | 'excluded' | 'withheld'; rows: TrafficRow[]; notes: string[] }

const ROWS: Array<{ key: string; label: string; unit: string; kind: 'limit' | 'encourage' }> = [
  { key: 'sodium', label: '나트륨', unit: 'mg', kind: 'limit' },
  { key: 'sugars', label: '당류', unit: 'g', kind: 'limit' },
  { key: 'sat_fat', label: '포화지방', unit: 'g', kind: 'limit' },
  { key: 'total_fat', label: '지방', unit: 'g', kind: 'limit' },
  { key: 'trans_fat', label: '트랜스지방', unit: 'g', kind: 'limit' },
  { key: 'cholesterol', label: '콜레스테롤', unit: 'mg', kind: 'limit' },
  { key: 'protein', label: '단백질', unit: 'g', kind: 'encourage' },
  { key: 'fiber', label: '식이섬유', unit: 'g', kind: 'encourage' },
]
const LIMIT: Record<string, [string, string]> = { red: ['높음', '▲'], yellow: ['보통', '◆'], green: ['낮음', '●'] }
const ENCOURAGE: Record<string, [string, string]> = { green: ['많음', '●'], yellow: ['보통', '◆'], gray: ['적음', '○'] }
const NONE: [string, string] = ['정보 없음', '○']

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const r1 = (v: number) => String(Math.round(v * 10) / 10)

function detailOf(n: Record<string, unknown>, unit: string): string {
  const basis = n['basis']
  const pct = num(n['pct_dv']); const per = num(n['per_100']); const amt = num(n['amount'])
  if (basis === 'pct_dv' && pct !== null) return `1일 기준치의 ${r1(pct)}%`
  if (basis === 'per_100g' && per !== null) return `100g당 ${r1(per)}${unit}`
  if (basis === 'per_100ml' && per !== null) return `100ml당 ${r1(per)}${unit}`
  if (basis === 'absolute' && amt !== null) return `${r1(amt)}${unit}`
  return ''
}

/** 서버 traffic_light → 카드 뷰. 카드를 그리지 않을 때 null(R1·R7). */
export function trafficCardView(tl: MsTrafficLight | null | undefined): TrafficCardView | null {
  if (!tl || typeof tl !== 'object') return null
  const t = tl as Record<string, unknown>
  if (t['is_excluded'] === true) {
    const r = typeof t['exclude_reason'] === 'string' ? (t['exclude_reason'] as string) : ''
    return { mode: 'excluded', rows: [], notes: [TC_EXCLUDED[r] ?? TC_EXCLUDED._other] }
  }
  const ctx = Array.isArray(t['context_messages']) ? (t['context_messages'] as unknown[]).filter((m): m is string => typeof m === 'string' && !!m.trim()) : []
  if (t['is_withheld'] === true) return { mode: 'withheld', rows: [], notes: [ctx[0] ?? TC_WITHHELD_DEFAULT] }
  const nut = (tl.nutrients ?? {}) as Record<string, Record<string, unknown> | null>
  const rows: TrafficRow[] = ROWS.map((d) => {
    const n = nut[d.key] ?? null
    const c = n && typeof n['color'] === 'string' ? (n['color'] as string) : null
    const table = d.kind === 'limit' ? LIMIT : ENCOURAGE
    const hit = c ? table[c] : undefined
    if (!n || !hit) return { key: d.key, label: d.label, text: NONE[0], shape: NONE[1], detail: '', tone: 'none' }
    return { key: d.key, label: d.label, text: hit[0], shape: hit[1], detail: detailOf(n, d.unit), tone: c as Tone }
  })
  if (rows.every((r) => r.tone === 'none')) return null
  const notes: string[] = ctx.filter((m) => CONTEXT_WHITELIST.some((p) => m.startsWith(p)))
  const ms = t['multi_serving'] as Record<string, unknown> | null | undefined
  if (ms && typeof ms['message'] === 'string' && ms['message']) notes.push(ms['message'] as string)
  if (rows.some((r) => r.tone === 'none')) notes.push(TC_MISSING_NOTE)
  notes.push(TC_FOOTER)
  return { mode: 'normal', rows, notes }
}
