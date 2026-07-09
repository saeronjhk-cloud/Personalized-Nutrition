// 개인화 엔진 v2 — 설문(기저질환·목표) × 제품 -> "나에게 중요한 항목".
//
// 원칙(64 재평가 v1, IP): 개인화는 영양 기준을 새로 만들지 않는다.
//   개인화 = "사용자 상태/목표 -> 관심 영양소 매핑"(결정적).
//   판정 = 먹선 traffic_light(basis-aware·이중기준·RACC·KDRI/FSA)의 색을 그대로 소비.
//   UI    = "왜 이 영양소를 보라는지 + 먹선 색".
// 자체 절대임계(구 NUTRIENT.threshold)는 폐기(basis 혼재·근거 부재·먹선 철학 충돌).
//
// Must-close 4(리뷰 반영):
//   1) polarity: limit(높으면 주의)만 경고. protein/fiber(encourage)·carbs/calories(neutral)는 경고 대상 아님.
//   2) null/회색 = "판정 없음"이지 "안전" 아님. 경고 미발화하되 안전 취급·안전 문구 금지(hasUnknown로 구분).
//   3) provenance: 결과에 source/nutrient_key/color/basis/pct_dv/per_100/rule_id/user_reason 기록.
//   4) Eval: 값이 아니라 색+basis+null 중심(EVAL_CASES).
// 비진단: 전부 생활관리 참고(처리방침 §3-2 정합).
import type { SurveyAnswers } from '../../types'
import type { MsNutrition, MsTrafficLight, TrafficLightColor } from '../../lib/meokseon'

type NutrientKey = 'sodium' | 'total_sugars' | 'total_carbs' | 'saturated_fat' | 'trans_fat' | 'cholesterol' | 'calories'
export type NutrientIntent = 'limit' | 'encourage' | 'neutral'

// 개인화 관심 영양소 -> 먹선 traffic_light key + polarity + 표시 메타.
// lightKey=null(neutral)은 먹선 신호등 비대상(탄수/열량) -> 색 판정 없이 중립 값만.
const NUTRIENT: Record<NutrientKey, { lightKey: string | null; intent: NutrientIntent; label: string; unit: string }> = {
  sodium:        { lightKey: 'sodium',      intent: 'limit',   label: '나트륨',     unit: 'mg' },
  total_sugars:  { lightKey: 'sugars',      intent: 'limit',   label: '당류',       unit: 'g' },
  saturated_fat: { lightKey: 'sat_fat',     intent: 'limit',   label: '포화지방',   unit: 'g' },
  trans_fat:     { lightKey: 'trans_fat',   intent: 'limit',   label: '트랜스지방', unit: 'g' },
  cholesterol:   { lightKey: 'cholesterol', intent: 'limit',   label: '콜레스테롤', unit: 'mg' },
  total_carbs:   { lightKey: null,          intent: 'neutral', label: '탄수화물',   unit: 'g' },
  calories:      { lightKey: null,          intent: 'neutral', label: '열량',       unit: 'kcal' },
}

// 규칙: 기저질환/목표 매칭 -> 관심 영양소 + 사유. condition 우선(사유 표기 우위).
interface Rule { id: string; match: string[]; nutrients: NutrientKey[]; reason: string; kind: 'condition' | 'goal' }
const RULES: Rule[] = [
  { id: 'hypertension_sodium',   match: ['고혈압'],          nutrients: ['sodium'],                                       reason: '고혈압 관리 중',   kind: 'condition' },
  { id: 'kidney_sodium',         match: ['신장질환'],        nutrients: ['sodium'],                                       reason: '신장 건강 관리 중', kind: 'condition' },
  { id: 'diabetes_sugar',        match: ['당뇨'],            nutrients: ['total_sugars', 'total_carbs'],                  reason: '당뇨 관리 중',     kind: 'condition' },
  { id: 'dyslipidemia_fat',      match: ['고지혈증'],        nutrients: ['saturated_fat', 'trans_fat', 'cholesterol'],    reason: '고지혈증 관리 중', kind: 'condition' },
  { id: 'metabolic_energy',      match: ['비만_대사증후군'], nutrients: ['calories', 'total_sugars', 'sodium'],           reason: '대사 관리 중',     kind: 'condition' },
  { id: 'liver_condition',       match: ['간질환'],          nutrients: ['total_sugars', 'saturated_fat'],                reason: '간 건강 관리 중',  kind: 'condition' },
  { id: 'glucose_goal',          match: ['혈당관리'],        nutrients: ['total_sugars', 'total_carbs'],                  reason: '혈당 관리 목표',   kind: 'goal' },
  { id: 'cardio_goal',           match: ['심혈관건강'],      nutrients: ['sodium', 'saturated_fat', 'trans_fat', 'cholesterol'], reason: '심혈관 목표', kind: 'goal' },
  { id: 'weight_goal',           match: ['체중관리'],        nutrients: ['calories', 'total_sugars'],                     reason: '체중 관리 목표',   kind: 'goal' },
  { id: 'liver_goal',            match: ['간건강'],          nutrients: ['saturated_fat', 'total_sugars'],                reason: '간 건강 목표',     kind: 'goal' },
]

export interface PersonalItem {
  key: NutrientKey
  nutrient_key: string | null   // 먹선 traffic_light key(neutral이면 null)
  label: string
  unit: string
  intent: NutrientIntent
  color: TrafficLightColor      // 먹선 색(green/yellow/red/null)
  basis: string | null          // 먹선 판정 근거
  pct_dv: number | null
  per_100: number | null
  value: number | null          // 원시 nutrition 값(표시용, 판정 아님)
  reason: string                // 대표 사유(condition 우선; 예: '고혈압 관리 중')
  user_reason: string           // 대표 사유(reason과 동일 축; 추적용)
  matched_reasons: string[]     // 이 영양소에 걸린 모든 사유(다중 질환/목표 보존, 리뷰 B)
  matched_rule_ids: string[]    // 매칭된 모든 rule_id
  rule_id: string               // 대표 rule_id
  // 판정 상태: warn=주의(red/yellow), ok=먹선 양호(green), unknown=판정없음(회색/결측), neutral=색 비대상
  status: 'warn' | 'ok' | 'unknown' | 'neutral'
  action: 'warn' | 'no_warning'
  source: 'meokseon_traffic_light'
}

export interface PersonalizeResult {
  applicable: boolean            // 관련 기저질환/목표가 있어 개인화 성립
  items: PersonalItem[]          // 매핑된 전 영양소(limit+neutral)
  warnings: PersonalItem[]       // status==='warn'만(UI 주의 카드)
  judgedCount: number            // 먹선 색으로 판정된 limit 영양소 수(green/yellow/red)
  hasUnknown: boolean            // 판정 없음(회색/결측)인 limit 영양소 존재 -> "안전" 주장 금지
}

function normColor(c: unknown): TrafficLightColor {
  return (c === 'green' || c === 'yellow' || c === 'red') ? c : null
}

export function personalizeProduct(
  nutrition: MsNutrition | null,
  trafficLight: MsTrafficLight | null,
  answers: SurveyAnswers,
): PersonalizeResult {
  const conditions = new Set(answers.기저질환 || [])
  const goals = new Set(answers.목표 || [])

  // 영양소별 사유 수집. 대표 사유는 condition 우선, 단 매칭된 모든 사유/규칙은 보존(디버깅·설명, 리뷰 B).
  const picked = new Map<NutrientKey, { reason: string; kind: 'condition' | 'goal'; rule_id: string; matched_reasons: string[]; matched_rule_ids: string[] }>()
  let applicable = false
  for (const rule of RULES) {
    const hit = rule.match.some((m) => (rule.kind === 'condition' ? conditions.has(m) : goals.has(m)))
    if (!hit) continue
    applicable = true
    for (const n of rule.nutrients) {
      const cur = picked.get(n)
      if (!cur) {
        picked.set(n, { reason: rule.reason, kind: rule.kind, rule_id: rule.id, matched_reasons: [rule.reason], matched_rule_ids: [rule.id] })
      } else {
        cur.matched_reasons.push(rule.reason)
        cur.matched_rule_ids.push(rule.id)
        if (cur.kind === 'goal' && rule.kind === 'condition') { cur.reason = rule.reason; cur.kind = rule.kind; cur.rule_id = rule.id } // 대표 사유 condition 우선
      }
    }
  }

  const lights = (trafficLight && trafficLight.nutrients) || {}
  const items: PersonalItem[] = []

  for (const [n, meta] of picked) {
    const map = NUTRIENT[n]
    const rawVal = nutrition ? nutrition[n as keyof MsNutrition] : null
    const value = typeof rawVal === 'number' ? rawVal : null

    if (map.intent !== 'limit' || !map.lightKey) {
      // neutral(탄수/열량): 색 판정 금지. 값만 중립 참고.
      items.push({
        key: n, nutrient_key: null, label: map.label, unit: map.unit, intent: map.intent,
        color: null, basis: null, pct_dv: null, per_100: null, value,
        reason: meta.reason, user_reason: meta.reason,
        matched_reasons: meta.matched_reasons, matched_rule_ids: meta.matched_rule_ids, rule_id: meta.rule_id,
        status: 'neutral', action: 'no_warning', source: 'meokseon_traffic_light',
      })
      continue
    }

    const light = lights[map.lightKey] || null
    const color = normColor(light && light.color)
    let status: PersonalItem['status']
    if (color === 'red' || color === 'yellow') status = 'warn'
    else if (color === 'green') status = 'ok'
    else status = 'unknown' // null/회색/결측 -> 판정 없음(안전 아님)

    items.push({
      key: n, nutrient_key: map.lightKey, label: map.label, unit: map.unit, intent: 'limit',
      color,
      basis: (light && (light.basis ?? null)) ?? null,
      pct_dv: (light && (light.pct_dv ?? null)) ?? null,
      per_100: (light && (light.per_100 ?? null)) ?? null,
      value,
      reason: meta.reason, user_reason: meta.reason,
      matched_reasons: meta.matched_reasons, matched_rule_ids: meta.matched_rule_ids, rule_id: meta.rule_id,
      status,
      action: status === 'warn' ? 'warn' : 'no_warning',
      source: 'meokseon_traffic_light',
    })
  }

  const limitItems = items.filter((i) => i.intent === 'limit')
  const warnings = limitItems.filter((i) => i.status === 'warn')
  // 주의는 red > yellow, 그다음 사유(condition 우선은 이미 picked에서 반영) 순.
  const colorRank: Record<string, number> = { red: 2, yellow: 1 }
  warnings.sort((a, b) => (colorRank[b.color || ''] || 0) - (colorRank[a.color || ''] || 0))
  const judgedCount = limitItems.filter((i) => i.status === 'ok' || i.status === 'warn').length
  const hasUnknown = limitItems.some((i) => i.status === 'unknown')

  return { applicable, items, warnings, judgedCount, hasUnknown }
}

// ── Eval(원칙 4: 색+basis+null 중심). runEval()로 자체 확인. IP 정본: 64_먹선개인화_Eval셋_v2.jsonl ──
export interface EvalCase {
  name: string
  answers: Partial<SurveyAnswers>
  trafficLight: MsTrafficLight | null
  nutrition?: MsNutrition | null
  expectApplicable: boolean
  expectWarnKeys: string[]      // 주의(red/yellow limit) 기대 키
  expectHasUnknown?: boolean    // 판정 없음(회색/결측) limit 존재 기대(안전 취급 금지 회귀)
}

function tl(nutrients: Record<string, TrafficLightColor>): MsTrafficLight {
  const out: Record<string, { color: TrafficLightColor }> = {}
  for (const k of Object.keys(nutrients)) out[k] = { color: nutrients[k] }
  return { nutrients: out }
}

export const EVAL_CASES: EvalCase[] = [
  { name: '고혈압 + 나트륨 red -> 주의', answers: { 기저질환: ['고혈압'], 목표: [] }, trafficLight: tl({ sodium: 'red' }), expectApplicable: true, expectWarnKeys: ['sodium'] },
  { name: '고혈압 + 나트륨 yellow -> 주의', answers: { 기저질환: ['고혈압'], 목표: [] }, trafficLight: tl({ sodium: 'yellow' }), expectApplicable: true, expectWarnKeys: ['sodium'] },
  { name: '고혈압 + 나트륨 green -> 표시 안 함(양호)', answers: { 기저질환: ['고혈압'], 목표: [] }, trafficLight: tl({ sodium: 'green' }), expectApplicable: true, expectWarnKeys: [], expectHasUnknown: false },
  { name: '고혈압 + 나트륨 null -> 주의 없음이나 안전 아님', answers: { 기저질환: ['고혈압'], 목표: [] }, trafficLight: tl({ sodium: null }), expectApplicable: true, expectWarnKeys: [], expectHasUnknown: true },
  { name: '고혈압 + traffic_light 누락 -> fail-open 금지(판정 없음)', answers: { 기저질환: ['고혈압'], 목표: [] }, trafficLight: null, expectApplicable: true, expectWarnKeys: [], expectHasUnknown: true },
  { name: '당뇨 + 당류 red -> 주의(탄수는 neutral 제외)', answers: { 기저질환: ['당뇨'], 목표: [] }, trafficLight: tl({ sugars: 'red' }), expectApplicable: true, expectWarnKeys: ['total_sugars'] },
  { name: '당뇨 + 당류 null -> 주의 없음이나 안전 아님', answers: { 기저질환: ['당뇨'], 목표: [] }, trafficLight: tl({ sugars: null }), expectApplicable: true, expectWarnKeys: [], expectHasUnknown: true },
  { name: '고지혈 + 포화 red -> 주의', answers: { 기저질환: ['고지혈증'], 목표: [] }, trafficLight: tl({ sat_fat: 'red', trans_fat: 'green', cholesterol: 'green' }), expectApplicable: true, expectWarnKeys: ['saturated_fat'] },
  { name: '고지혈 + 전부 green -> 표시 안 함', answers: { 기저질환: ['고지혈증'], 목표: [] }, trafficLight: tl({ sat_fat: 'green', trans_fat: 'green', cholesterol: 'green' }), expectApplicable: true, expectWarnKeys: [], expectHasUnknown: false },
  { name: '고지혈 + 트랜스 red + 콜레 red -> 둘 주의', answers: { 기저질환: ['고지혈증'], 목표: [] }, trafficLight: tl({ sat_fat: 'green', trans_fat: 'red', cholesterol: 'red' }), expectApplicable: true, expectWarnKeys: ['trans_fat', 'cholesterol'] },
  { name: '관련 없음 -> 비적용', answers: { 기저질환: [], 목표: ['피로회복'] }, trafficLight: tl({ sodium: 'red' }), expectApplicable: false, expectWarnKeys: [] },
  { name: '혈당관리 + 탄수만 있고 당류 신호등 없음 -> 탄수 neutral(색 판정 금지)', answers: { 기저질환: [], 목표: ['혈당관리'] }, trafficLight: tl({}), nutrition: { total_carbs: 80 }, expectApplicable: true, expectWarnKeys: [], expectHasUnknown: true },
  { name: '체중관리 + 열량 높음 but 신호등 key 없음 -> 색 판정 금지', answers: { 기저질환: [], 목표: ['체중관리'] }, trafficLight: tl({ sugars: 'green' }), nutrition: { calories: 500 }, expectApplicable: true, expectWarnKeys: [], expectHasUnknown: false },
  { name: '고혈압 + protein red 존재 -> encourage 무시(주의 아님)', answers: { 기저질환: ['고혈압'], 목표: [] }, trafficLight: tl({ sodium: 'green', protein: 'red', fiber: 'red' }), expectApplicable: true, expectWarnKeys: [], expectHasUnknown: false },
  { name: '심혈관 목표 + 나트륨 red + 포화 green -> 나트륨만 주의', answers: { 기저질환: [], 목표: ['심혈관건강'] }, trafficLight: tl({ sodium: 'red', sat_fat: 'green', trans_fat: 'green', cholesterol: 'green' }), expectApplicable: true, expectWarnKeys: ['sodium'] },
  { name: '고혈압+당뇨 복합 + 나트륨 red + 당류 yellow -> 둘 주의', answers: { 기저질환: ['고혈압', '당뇨'], 목표: [] }, trafficLight: tl({ sodium: 'red', sugars: 'yellow' }), expectApplicable: true, expectWarnKeys: ['sodium', 'total_sugars'] },
  { name: 'RACC 면제 등 먹선 yellow -> 색 그대로 소비(주의)', answers: { 기저질환: ['고혈압'], 목표: [] }, trafficLight: tl({ sodium: 'yellow' }), expectApplicable: true, expectWarnKeys: ['sodium'] },
]

export function runEval(): { pass: number; fail: number; failures: string[] } {
  let pass = 0, fail = 0; const failures: string[] = []
  for (const c of EVAL_CASES) {
    const r = personalizeProduct(c.nutrition ?? null, c.trafficLight, c.answers as SurveyAnswers)
    const keys = r.warnings.map((w) => w.key).sort()
    const okKeys = JSON.stringify(keys) === JSON.stringify([...c.expectWarnKeys].sort())
    const okApp = r.applicable === c.expectApplicable
    const okUnknown = c.expectHasUnknown === undefined || r.hasUnknown === c.expectHasUnknown
    if (okKeys && okApp && okUnknown) pass++
    else { fail++; failures.push(`${c.name} (applicable=${r.applicable}, warns=${keys.join(',')}, hasUnknown=${r.hasUnknown})`) }
  }
  return { pass, fail, failures }
}
