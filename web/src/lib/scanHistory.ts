/**
 * 스캔 이력(리텐션 B축) — "사용자 본인 소유" 데이터.
 *
 * 계측(events.ts, 익명 집계)과 명확히 분리된다. 이건 사용자에게 되돌려주는 개인 자산이다:
 *  - 로그인 사용자: 자체 Supabase scan_history(RLS 본인 행 한정, hard-delete) — 교차기기 지속.
 *  - 비로그인 사용자: 로컬(localStorage)에만 저장(서버 미전송). 개인정보 무관·무인증 원칙 유지.
 *  - Supabase 오류(미마이그레이션 등) 시 로컬로 폴백 — 기능이 조용히 열화될 뿐 깨지지 않는다.
 *  - [프라이버시] 제품 팩트만 저장. 설문 파생 개인화(주의 영양소)는 미저장 — 조회 시 재계산.
 *
 * 주간 패턴 요약(summarizeScans)은 결정적 순수 함수(원칙 5: 엔진 내 산출, AI 추론 아님).
 * 스키마: supabase/phase_p15_meokseon_events_and_scans_v1.sql
 */
import { supabase } from './supabase'
import type {
  MsProductResult,
  MsAdditiveSummary,
  MsNutrition,
  TrafficLightColor,
} from './meokseon'

const LOCAL_KEY = 'meokseon_scan_history'
const LOCAL_CAP = 50

export interface ScanAdditiveSummary {
  total: number
  green: number
  yellow: number
  orange: number
  red: number
}

export interface ScanRecord {
  id: string
  scanned_at: string // ISO 8601
  barcode: string
  product_name: string
  brand: string | null
  food_category: string | null
  image_url: string | null
  nutrition: MsNutrition | null
  additives: ScanAdditiveSummary | null
  // 먹선 신호등 정본 판정의 스냅샷(IP/136 P1-1). **제품 팩트**이며 사용자와 무관하다
  //   — 같은 제품이면 모든 사용자에게 동일하므로 아래 프라이버시 doctrine 을 위반하지 않는다.
  //   nutrition jsonb 에 이미 나트륨·당류 원수치가 있고 색은 그로부터 결정론적으로 도출된 값 →
  //   새로운 정보 계층이 아니다(IP/136 §6.2-3).
  // null = "판정 없음"(회색/결측)이며 **"안전"이 아니다**(meokseon.ts:52). 절대 false/green 으로
  //   메우지 않는다 — 오케스트레이터 producers 는 red 만 카운트한다.
  sodium_color: TrafficLightColor
  sugars_color: TrafficLightColor
  // [프라이버시] 스캔 이력에는 "제품 팩트"만 저장. 설문에서 유도된 개인화 플래그(주의 영양소)는
  //   건강상태 추론 파생정보가 될 수 있어 저장하지 않는다. "내 기준으로 보기"는 조회 시점에 재계산.
}

export type SaveTarget = 'cloud' | 'local'

function genId(): string {
  return typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
    ? (crypto as any).randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 조회 결과 → 저장용 레코드. 제품 팩트만 저장(설문 파생 개인화는 미저장 — 조회 시 재계산). */
/** 먹선 정본 판정에서 색만 추출. 자체 임계를 만들지 않는다(meokseon.ts:51). 미판정은 null 유지. */
function tlColor(result: MsProductResult, key: 'sodium' | 'sugars'): TrafficLightColor {
  const c = result.traffic_light?.nutrients?.[key]?.color
  return c === 'green' || c === 'yellow' || c === 'red' ? c : null
}

export function buildScanRecord(
  result: MsProductResult,
  additives: MsAdditiveSummary | null,
): ScanRecord {
  const by = additives?.risk_summary?.by_color
  return {
    id: genId(),
    scanned_at: new Date().toISOString(),
    barcode: result.product.barcode,
    product_name: result.product.product_name,
    brand: result.product.brand ?? null,
    food_category: result.product.food_category ?? null,
    image_url: result.product.image_url ?? null,
    nutrition: result.nutrition ?? null,
    sodium_color: tlColor(result, 'sodium'),
    sugars_color: tlColor(result, 'sugars'),
    additives: additives
      ? {
          total: additives.risk_summary?.total ?? 0,
          green: by?.green ?? 0,
          yellow: by?.yellow ?? 0,
          orange: by?.orange ?? 0,
          red: by?.red ?? 0,
        }
      : null,
  }
}

// ── 로컬(비로그인/폴백) ────────────────────────────────────────────────
function readLocal(): ScanRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ScanRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(records: ScanRecord[]): void {
  // 개수 상한(LOCAL_CAP) + 바이트 상한(QuotaExceeded) 이중 방어.
  // 최신순 배열에서 가장 오래된 것부터 밀어내며(LRU-by-recency) 저장이 성공할 때까지 재시도.
  let list = records.slice(0, LOCAL_CAP)
  for (let attempt = 0; attempt < LOCAL_CAP; attempt++) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
      return
    } catch {
      if (list.length <= 1) {
        // 1건도 안 들어가면(공간 없음) 키를 비우고 포기 — UX엔 영향 없음
        try { localStorage.removeItem(LOCAL_KEY) } catch { /* 무시 */ }
        return
      }
      list = list.slice(0, list.length - 1) // 가장 오래된 1건 제거 후 재시도
    }
  }
}

function saveLocal(rec: ScanRecord): void {
  const list = readLocal()
  // 같은 바코드가 이미 있으면 최신으로 갱신(중복 방지)
  const deduped = list.filter((r) => r.barcode !== rec.barcode)
  deduped.unshift(rec)
  writeLocal(deduped)
}

// ── 저장 ───────────────────────────────────────────────────────────────
/**
 * 스캔 1건 저장. 반환값은 실제 저장 위치(계측 saved_to에 사용).
 * 로그인 시 Supabase, 실패 시 로컬 폴백. 비로그인 시 로컬.
 */
export async function saveScan(rec: ScanRecord): Promise<SaveTarget> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const base = {
        user_id: user.id,
        barcode: rec.barcode,
        product_name: rec.product_name,
        brand: rec.brand,
        food_category: rec.food_category,
        image_url: rec.image_url,
        nutrition: rec.nutrition,
        additives: rec.additives,
      }
      // 색 2필드는 마이그레이션 136 이후에만 존재한다.
      const { error } = await supabase.from('scan_history').insert({
        ...base,
        sodium_color: rec.sodium_color,
        sugars_color: rec.sugars_color,
      })
      if (!error) return 'cloud'

      // [배포 순서 방어] 마이그레이션 136 미적용 상태에서 이 프론트가 먼저 나가면 42703
      //   (undefined_column) 이 난다. 그대로 두면 **라이브 사용자의 스캔이 전부 로컬로 떨어져**
      //   교차기기 이력이 끊긴다(기존 폴백은 '로컬'이라 조용히 열화됨). 색 없이 1회 재시도해
      //   클라우드 저장을 지켜낸다. 색은 어차피 마이그레이션 후 백필 잡(P0-2)이 채운다.
      //   정상 배포 순서(마이그레이션 → 프론트)에서는 이 경로를 타지 않는다.
      if (error.code === '42703') {
        const retry = await supabase.from('scan_history').insert(base)
        if (!retry.error) {
          console.debug('[scanHistory] 색 컬럼 미존재(마이그레이션 136 미적용) — 색 없이 저장')
          return 'cloud'
        }
      }
      console.debug('[scanHistory] cloud insert failed, fallback local:', error.message)
    }
  } catch (e) {
    console.debug('[scanHistory] auth/insert error, fallback local:', e)
  }
  saveLocal(rec)
  return 'local'
}

// ── 승격(비로그인 → 로그인) ─────────────────────────────────────────────
/**
 * 비로그인 상태에서 localStorage 에 쌓인 스캔을 로그인 사용자 행으로 **승격**한다.
 *
 * ★ 왜 필요한가 (세션31 실측 — IP/145 §8-2 는 이 문제를 과소평가했다):
 *   §8-2 는 "비로그인 스캔은 로컬에만 저장 → **기기 바꾸면** 사라진다"고 적었다.
 *   실제로는 **기기를 바꾸지 않아도 로그인하는 순간 사라진다.**
 *   listScans() 는 로그인 사용자에게 cloud 를 읽는데, cloud 가 0건이어도 PostgREST 는
 *   data=[] (error=null) 을 주므로 `if (!error && data)` 가 참이 되어 [] 를 리턴한다
 *   → readLocal() 폴백을 **타지 않는다**. 그래서 이력이 통째로 증발한 것처럼 보인다.
 *   데이터는 localStorage 에 살아있다 → 유실이 아니라 **미승격**이고, 그래서 복구된다.
 *
 * 계약:
 *   · 멱등. 여러 번 불러도 행이 늘지 않는다(서버 부분 유니크 인덱스 + on conflict do nothing).
 *   · 로컬이 비었거나 비로그인이면 **no-op**(네트워크 호출 없음). 어디서든 부담 없이 부를 수 있다.
 *   · **성공했을 때만 로컬을 비운다.** 실패 시 보존 → 다음 진입에서 재시도된다.
 *   · user_id·promoted_at 은 **서버가 정한다**(RPC). 클라이언트가 못 속인다 — IP/146 참조.
 */
export type PromoteStatus = 'noop' | 'promoted' | 'error'
export interface PromoteResult {
  status: PromoteStatus
  attempted: number   // 서버로 보낸 행 수
  promoted: number    // 실제로 새로 삽입된 행 수(중복 스킵분 제외)
}

export async function promoteLocalScans(): Promise<PromoteResult> {
  const local = readLocal()
  if (local.length === 0) return { status: 'noop', attempted: 0, promoted: 0 }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: 'noop', attempted: 0, promoted: 0 }

    // scanned_at(ISO 문자열) → epoch ms. 서버가 jsonb_typeof='number' 로 쓰레기를 거르지만,
    // 로컬 포맷의 주인은 클라이언트이므로 여기서 먼저 정규화한다. 파싱 불가 행은 버린다.
    const rows = local
      .map((r) => {
        const ms = new Date(r.scanned_at).getTime()
        if (!r.barcode || !Number.isFinite(ms)) return null
        return {
          scanned_at_ms: ms,
          barcode: r.barcode,
          product_name: r.product_name,
          brand: r.brand,
          food_category: r.food_category,
          image_url: r.image_url,
          nutrition: r.nutrition,
          additives: r.additives,
          sodium_color: r.sodium_color,
          sugars_color: r.sugars_color,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, LOCAL_CAP)   // 서버 상한(50)과 동일한 단일 출처

    if (rows.length === 0) {
      // 로컬이 전부 손상 — 재시도해도 결과가 같다. 무한 재시도 루프를 만들지 않는다.
      try { localStorage.removeItem(LOCAL_KEY) } catch { /* 무시 */ }
      return { status: 'noop', attempted: 0, promoted: 0 }
    }

    const { data, error } = await supabase.rpc('promote_local_scans', { p_scans: rows })
    if (error) {
      // 146 미적용(42883 undefined_function) · 오프라인 등. 로컬을 **비우지 않는다**.
      console.debug('[scanHistory] 승격 실패 — 로컬 보존, 다음 진입에 재시도:', error.message)
      return { status: 'error', attempted: rows.length, promoted: 0 }
    }
    // ★ 성공한 뒤에만 비운다. 이 순서가 뒤집히면 승격 실패 시 진짜 유실이 된다.
    try { localStorage.removeItem(LOCAL_KEY) } catch { /* 무시 */ }
    return { status: 'promoted', attempted: rows.length, promoted: Number(data) || 0 }
  } catch (e) {
    console.debug('[scanHistory] 승격 예외 — 로컬 보존:', e)
    return { status: 'error', attempted: local.length, promoted: 0 }
  }
}

// ── 조회 ───────────────────────────────────────────────────────────────
function mapRow(row: Record<string, any>): ScanRecord {
  return {
    id: String(row.id),
    scanned_at: row.scanned_at ?? row.created_at ?? new Date().toISOString(),
    barcode: row.barcode ?? '',
    product_name: row.product_name ?? '',
    brand: row.brand ?? null,
    food_category: row.food_category ?? null,
    image_url: row.image_url ?? null,
    nutrition: (row.nutrition as MsNutrition) ?? null,
    // 미마이그레이션 행/구버전 저장분은 색이 없다 → null = 판정 없음(안전 아님).
    sodium_color: (row.sodium_color as TrafficLightColor) ?? null,
    sugars_color: (row.sugars_color as TrafficLightColor) ?? null,
    additives: (row.additives as ScanAdditiveSummary) ?? null,
  }
}

/** 스캔 이력 목록(최신순). 로그인 시 Supabase(삭제분 제외), 실패/비로그인 시 로컬. */
export async function listScans(limit = 50): Promise<ScanRecord[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('scan_history')
        // [의도적] 색 2필드를 select 하지 않는다. 이력 UI 는 색을 소비하지 않고, 넣으면
        //   마이그레이션 136 미적용 시 42703 → **이력 조회 전체가 로컬 폴백**되는 읽기 경로
        //   회귀를 만든다. 색의 소비자는 오케스트레이터(loaders.ts)이며 DB 를 직접 읽는다.
        //   mapRow 는 색을 방어적으로 매핑해 두었으므로, 훗날 UI 가 필요해지면 이 select 에
        //   두 컬럼만 추가하면 된다(그때는 마이그레이션이 이미 적용된 뒤다).
        .select('id, scanned_at, barcode, product_name, brand, food_category, image_url, nutrition, additives')
        .eq('user_id', user.id)
        .order('scanned_at', { ascending: false })
        .limit(limit)
      if (!error && data) return data.map(mapRow)
      if (error) console.debug('[scanHistory] cloud list failed, fallback local:', error.message)
    }
  } catch (e) {
    console.debug('[scanHistory] auth/list error, fallback local:', e)
  }
  return readLocal().slice(0, limit)
}

/** 스캔 이력 삭제 — [PIPA] 로그인=물리 DELETE(즉시 영구 파기), 로컬=제거. soft-delete 아님. */
export async function deleteScan(id: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('scan_history')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
      if (!error && data && data.length > 0) return true
      // 로컬에도 있을 수 있으니 아래로 폴백
    }
  } catch {
    // 폴백
  }
  const list = readLocal()
  const next = list.filter((r) => r.id !== id)
  if (next.length !== list.length) {
    writeLocal(next)
    return true
  }
  return false
}

// ── 주간 패턴 요약(결정적 순수 함수) ─────────────────────────────────────
export interface WeekBucket {
  week: string // 'YYYY-Www' (ISO week)
  n: number
}
export interface ScanSummary {
  total: number
  last7Days: number
  thisISOWeek: number
  topCategories: { name: string; n: number }[]
  weeks: WeekBucket[] // 최근 8주(최신 우측)
  streakWeeks: number // 최근부터 연속으로 1건 이상 스캔한 주 수
}

/** ISO 8601 week key: 'YYYY-Www' (월요일 시작). */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7 // 월=0..일=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // 목요일로 이동
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function summarizeScans(records: ScanRecord[], now: Date = new Date()): ScanSummary {
  const total = records.length
  const nowMs = now.getTime()
  const weekOf = isoWeekKey(now)

  let last7Days = 0
  let thisISOWeek = 0
  const catMap = new Map<string, number>()
  const weekMap = new Map<string, number>()

  for (const r of records) {
    const t = new Date(r.scanned_at)
    const ms = t.getTime()
    if (!Number.isNaN(ms)) {
      if (nowMs - ms <= 7 * 24 * 3600 * 1000 && ms <= nowMs) last7Days++
      const wk = isoWeekKey(t)
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + 1)
      if (wk === weekOf) thisISOWeek++
    }
    if (r.food_category) catMap.set(r.food_category, (catMap.get(r.food_category) ?? 0) + 1)
  }

  const topCategories = Array.from(catMap.entries())
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)

  // 최근 8주 연속 버킷(빈 주는 0으로 채움).
  const weeks: WeekBucket[] = []
  const cursor = new Date(now)
  for (let i = 0; i < 8; i++) {
    const key = isoWeekKey(cursor)
    weeks.unshift({ week: key, n: weekMap.get(key) ?? 0 })
    cursor.setDate(cursor.getDate() - 7)
  }

  // 연속 주 스트릭(가장 최근 주부터 역순으로 n>0 연속 카운트).
  let streakWeeks = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].n > 0) streakWeeks++
    else break
  }

  return { total, last7Days, thisISOWeek, topCategories, weeks, streakWeeks }
}
