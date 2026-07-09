#!/usr/bin/env node
/**
 * 먹선 개인화 임계 v2 재보정용 — 실제 제품 nutrition 분포 샘플러 (결정적, 무의존성).
 *
 * 목적(인수인계 65 §6 "임계 재보정 v2"): v1 임계(personalize.ts NUTRIENT.threshold)는 가설.
 *   실제 먹선 제품의 영양 분포를 뽑아 분위수를 근거로 v2를 제안한다("느낌" 금지, 원칙 4).
 *
 * ⚠️ 서버 계약 반영(2026-07-09, meokseon-server 코드 확인):
 *   1) Rate limit = 100req/15분(IP). 반드시 throttle(--delay-ms) + 429 백오프. 대량 실행은
 *      Railway 환경변수 API_RATE_LIMIT_MAX 를 일시 상향(예: 5000) 후 돌리는 것을 권장.
 *   2) 영양수치 basis 불확실(basis_confident/off_grade/confidence 존재). → "confident" 서브셋
 *      (basis_confident!==false && confidence!=='low')만으로 분포를 계산하는 것이 정본. raw 도 함께 출력.
 *   3) 임계는 personalize 가 "API가 준 값 그대로"에 적용하므로, per_100g 정규화 없이 "보고값" 분포로
 *      보정하는 것이 자기일관적(정본). per_100g 는 참고용.
 *
 * 사용(PowerShell):
 *   $env:MEOKSEON_API_URL="https://<railway>"
 *   node tools\meokseon_sample_v2_thresholds.mjs --per-term 40 --delay-ms 250 --out v2_distribution.json
 */

const API = (process.env.MEOKSEON_API_URL || argVal('--api') || '').replace(/\/$/, '')
if (!API) { console.error('MEOKSEON_API_URL(또는 --api) 필요'); process.exit(2) }

const TERMS = (argVal('--terms') || '라면,과자,음료,빵,소시지,시리얼,요구르트,아이스크림,만두,즉석밥').split(',').map(s => s.trim()).filter(Boolean)
const PER_TERM = parseInt(argVal('--per-term') || '40', 10)
const MIN_N = parseInt(argVal('--min-n') || '30', 10)       // 이 표본수 미만이면 v2 제안 보류(v1 유지)
const DELAY_MS = parseInt(argVal('--delay-ms') || '250', 10) // 요청 간 간격(rate limit 방어)
const NUTRIENTS = ['sodium', 'total_sugars', 'total_carbs', 'saturated_fat', 'trans_fat', 'cholesterol', 'calories']
const V1_THRESHOLD = { sodium: 600, total_sugars: 15, total_carbs: 45, saturated_fat: 5, trans_fat: 0.1, cholesterol: 60, calories: 400 }

function argVal(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// PG numeric/decimal 은 node-pg 가 문자열로 반환 → 숫자 강제 변환(유한값만).
function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : NaN }
  return NaN
}

// 429/일시 오류 백오프 포함 GET.
async function getJson(path, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt++) {
    if (DELAY_MS) await sleep(DELAY_MS)
    let res
    try { res = await fetch(`${API}${path}`) } catch (e) { if (attempt === tries - 1) throw e; await sleep(1000 * (attempt + 1)); continue }
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue } // rate limited → 백오프 후 재시도
    if (res.status === 404) { const e = new Error('404'); e.code = 404; throw e }
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    const j = await res.json()
    if (!j || j.success !== true) throw new Error(`bad shape ${path}`)
    return j.data
  }
  throw new Error(`429 반복(rate limit) ${path}`)
}

function pct(sorted, p) {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx]
}
// IQR 이상치 제거(오입력·비정상 값 왜곡 방지).
function removeOutliersIQR(values) {
  if (values.length < 8) return values.slice()
  const s = values.slice().sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))]
  const q1 = q(25), q3 = q(75), iqr = q3 - q1
  return s.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr)
}
function summarize(rawArr) {
  const clean = removeOutliersIQR(rawArr).sort((a, b) => a - b)
  return { count: clean.length, removed_outliers: rawArr.length - clean.length, p50: pct(clean, 50), p75: pct(clean, 75), p90: pct(clean, 90), p95: pct(clean, 95), _clean: clean }
}

async function main() {
  // 1) 바코드 수집(검색 + 선택적 seed 파일)
  const barcodes = new Set()
  const seedFile = argVal('--barcodes')
  if (seedFile) {
    const fs = await import('node:fs')
    for (const line of fs.readFileSync(seedFile, 'utf8').split(/\r?\n/)) {
      const b = line.trim().replace(/\D/g, ''); if (/^\d{8,14}$/.test(b)) barcodes.add(b)
    }
  }
  for (const term of TERMS) {
    try {
      const data = await getJson(`/api/products/search?q=${encodeURIComponent(term)}&limit=${PER_TERM}`)
      for (const p of (data.products || [])) if (p.barcode) barcodes.add(String(p.barcode).replace(/\D/g, ''))
    } catch (e) { console.error(`search "${term}": ${e.message}`) }
  }
  console.error(`바코드 ${barcodes.size}건 수집. 제품 조회 시작(delay ${DELAY_MS}ms)…`)

  // 2) 제품별 nutrition + basis 메타 수집
  const raw = {}, confident = {}
  for (const n of NUTRIENTS) { raw[n] = []; confident[n] = [] }
  let n_products = 0, n_confident = 0, n_off = 0

  for (const bc of barcodes) {
    let d
    try { d = await getJson(`/api/products/${encodeURIComponent(bc)}`) } catch { continue }
    const nut = d.nutrition
    if (!nut) continue
    n_products++
    // confident = basis 신뢰 + confidence 낮음 아님(리뷰어 RACC/basis 이슈 반영).
    // basis_confident 는 boolean 또는 문자열('true'/'false')로 올 수 있음(PG 반환) → 문자열도 처리.
    const bc2 = nut.basis_confident
    const isConfident = (bc2 !== false && bc2 !== 'false') && (nut.confidence !== 'low')
    if (isConfident) n_confident++
    if (/odbl/i.test(nut.source_license || '') || nut.source === 'openfoodfacts') n_off++
    for (const n of NUTRIENTS) {
      const v = num(nut[n]) // ⚠️ PG numeric 은 문자열로 반환 → 강제 변환(이전 count=0 버그 원인)
      if (!Number.isFinite(v)) continue
      raw[n].push(v)
      if (isConfident) confident[n].push(v)
    }
  }

  // 3) 요약 + v2 제안(confident 서브셋 기준, min-n 게이팅, 자동 승격 금지)
  const out = {
    generated_at: new Date().toISOString(), api: API, min_n: MIN_N, delay_ms: DELAY_MS,
    n_barcodes: barcodes.size, n_products, n_confident, n_openfoodfacts: n_off,
    note: 'v2_suggestion은 confident 서브셋 보고값 분포 기준의 "제안". 정책 확정 아님. n>=min_n + v1 색변화율 검토 + false-green 수동확인 + 64.jsonl 17/17 회귀 후에만 승격.',
    nutrients: {},
  }
  for (const n of NUTRIENTS) {
    const rawS = summarize(raw[n])
    const confS = summarize(confident[n])
    const v1 = V1_THRESHOLD[n]
    const base = confS._clean.length >= MIN_N ? confS : null // confident 표본 우선
    const overV1 = confS._clean.length ? confS._clean.filter((v) => v >= v1).length / confS._clean.length : null
    delete rawS._clean; delete confS._clean
    out.nutrients[n] = {
      reported_all: rawS,
      reported_confident: confS,
      v1_threshold: v1,
      v1_over_share_confident: overV1,             // v1로 "주의" 뜨는 confident 제품 비율
      v2_suggestion_p75_confident: base ? base.p75 : null,
      keep_v1: !base,                              // confident 표본 부족 → v1 유지(자동 승격 금지)
      promote: false,                              // 항상 false — 수동 검토·회귀 후 결정
    }
  }

  const json = JSON.stringify(out, null, 2) + '\n'
  const outFile = argVal('--out')
  if (outFile) {
    const fs = await import('node:fs')
    fs.writeFileSync(outFile, json, 'utf8')
    console.error(`저장: ${outFile} (제품 ${n_products}건, confident ${n_confident}건, OFF ${n_off}건)`)
  } else {
    process.stdout.write(json)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
