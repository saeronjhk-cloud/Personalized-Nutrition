/**
 * 주간 리포트 순수 뷰 로직 (supabase 비의존 — 테스트 대상).
 * 엔진 계약(report.v1): top_food_groups / macro_balance{avg,flags} / next_action / p2_teaser / coverage.
 * 근거 IP: 06 주간리포트 룰 스냅샷, 95 weekly_report 테이블, 96 이식 런북.
 */
const KST_OFFSET_MS = 9 * 3600 * 1000
const DAY_MS = 86400_000

// ── 엔진 계약 타입 ────────────────────────────────────────────────
export type Nutrient = 'sodium' | 'sugar' | 'calories' | 'protein' | 'fiber'
export type FlagDirection = 'over' | 'under'
export type FlagSeverity = 'high' | 'medium'

export interface MacroFlag {
  nutrient: Nutrient
  direction: FlagDirection
  severity: FlagSeverity
  avg?: number
  ref?: number
}
export interface MacroBalance { avg: Record<string, number>; flags: MacroFlag[] }
export interface FoodGroup { name: string; count: number }
export interface NextAction {
  source: string
  message: string
  evidence_level?: string
  guardrail_passed?: boolean
  blocked_reason?: string | null
}
export interface P2Teaser { show: boolean; message?: string | null }
export interface Coverage { days_logged: number; meals: number }

export interface WeeklyReportData {
  top_food_groups: FoodGroup[]
  macro_balance: MacroBalance
  next_action: NextAction
  p2_teaser: P2Teaser
  coverage: Coverage
}
export interface WeeklyReport {
  report_id: string
  period: { start: string; end: string }
  report: WeeklyReportData
  cached: boolean
  first_viewed_at: string | null
}

// ── 주간 네비 계산 (KST, 월~일) ───────────────────────────────────
/** 주어진 시각(기본 now)이 속한 KST 주의 월요일 YYYY-MM-DD. */
export function kstMonday(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  const dow = (kst.getUTCDay() + 6) % 7 // 월=0
  const monday = new Date(kst.getTime() - dow * DAY_MS)
  return monday.toISOString().slice(0, 10)
}
/** 최근 완결 주(지난주 월요일). Edge 기본 주간과 동일. */
export function lastCompletedWeekStart(now: Date = new Date()): string {
  return addDaysISO(kstMonday(now), -7)
}
/** YYYY-MM-DD에 일수 가감(UTC 정오 기준으로 DST 무영향). */
export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}
export function prevWeek(weekStart: string): string { return addDaysISO(weekStart, -7) }
export function nextWeek(weekStart: string): string { return addDaysISO(weekStart, 7) }
export function weekEnd(weekStart: string): string { return addDaysISO(weekStart, 6) }
/** 이 주가 최근 완결 주보다 미래인가(다음 주 이동 비활성 판정). */
export function isAfterLastCompleted(weekStart: string, now: Date = new Date()): boolean {
  return weekStart > lastCompletedWeekStart(now)
}
/** "6월 29일 ~ 7월 5일" 표기. */
export function formatWeekRange(weekStart: string): string {
  const md = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${Number(m)}월 ${Number(d)}일`
  }
  return `${md(weekStart)} ~ ${md(weekEnd(weekStart))}`
}

// ── flags 뷰 매핑 (색/라벨/화살표) ────────────────────────────────
const NUTRIENT_LABEL: Record<Nutrient, string> = {
  sodium: '나트륨', sugar: '당류', calories: '열량', protein: '단백질', fiber: '식이섬유',
}
export interface FlagView { label: string; arrow: '▲' | '▼'; colorVar: string; severity: FlagSeverity }
export function flagView(flag: MacroFlag): FlagView {
  const over = flag.direction === 'over'
  return {
    label: `${NUTRIENT_LABEL[flag.nutrient]} ${over ? '초과' : '부족'}`,
    arrow: over ? '▲' : '▼',
    colorVar: flag.severity === 'high' ? 'var(--danger)' : 'var(--warning)',
    severity: flag.severity,
  }
}

// ── coverage / 상태 ──────────────────────────────────────────────
export function coverageCaption(cov: Coverage): string {
  if (!cov || cov.meals === 0) return '이 주는 기록이 없어요.'
  return `이번 주 ${cov.days_logged}일 · ${cov.meals}끼 기록`
}
/** 기록 부족(엔진 insufficient_data). meals===0. */
export function isInsufficient(report: WeeklyReportData): boolean {
  return !report || !report.coverage || report.coverage.meals === 0
}

// ── envelope 파싱 (순수) ──────────────────────────────────────────
export class WeeklyReportError extends Error {
  code: string; retryable: boolean
  constructor(code: string, message: string, retryable = false) {
    super(message); this.code = code; this.retryable = retryable
  }
}
interface Envelope { ok?: boolean; data?: WeeklyReport; error?: { code?: string; message?: string; retryable?: boolean } }
/** envelope → WeeklyReport | 오류 throw. */
export function parseWeeklyEnvelope(json: unknown): WeeklyReport {
  const env = (json ?? {}) as Envelope
  if (!env.ok || !env.data) {
    const code = env.error?.code || 'INTERNAL'
    const retryable = !!env.error?.retryable
    throw new WeeklyReportError(code, `${env.error?.message || '리포트를 불러오지 못했어요'}${retryable ? ' (재시도 가능)' : ''}`, retryable)
  }
  return env.data
}

// ── 렌더 모델 (순수 — WeeklyReport.tsx 분기 로직의 단일 출처) ────────
// 컴포넌트가 이 셀렉터로 어떤 블록을 그릴지 결정한다(테스트된 로직 == 렌더 로직).
export type WeeklyRenderMode = 'loading' | 'error' | 'empty' | 'insufficient' | 'report'
export interface WeeklyRenderModel {
  mode: WeeklyRenderMode
  errorRetryable: boolean   // error 모드에서만 의미
  cached: boolean           // "저장된 리포트" 라벨
  showFoodGroups: boolean   // 음식군 칩 섹션(top_food_groups 있음)
  flagCount: number         // 영양 flags 개수
  showFlagsSuccess: boolean // flags 0 → "균형이 잘 잡힌" 배너
  showP2: boolean           // p2 티저(show && message)
}
export interface WeeklyRenderState {
  loading: boolean
  error: { retryable?: boolean } | null
  data: WeeklyReport | null
}
/** (loading, error, data) → 렌더 모델. 상호배타 mode + 리포트 하위 블록 플래그. */
export function weeklyRenderModel(s: WeeklyRenderState): WeeklyRenderModel {
  const base: WeeklyRenderModel = {
    mode: 'empty', errorRetryable: false, cached: false,
    showFoodGroups: false, flagCount: 0, showFlagsSuccess: false, showP2: false,
  }
  if (s.loading) return { ...base, mode: 'loading' }
  if (s.error) return { ...base, mode: 'error', errorRetryable: !!s.error.retryable }
  const rep = s.data?.report
  if (!rep) return base // mode 'empty' (헤더·네비만)
  const cached = !!s.data?.cached
  if (isInsufficient(rep)) return { ...base, mode: 'insufficient', cached }
  const flags = rep.macro_balance?.flags ?? []
  return {
    mode: 'report',
    errorRetryable: false,
    cached,
    showFoodGroups: (rep.top_food_groups?.length ?? 0) > 0,
    flagCount: flags.length,
    showFlagsSuccess: flags.length === 0,
    showP2: !!(rep.p2_teaser?.show && rep.p2_teaser?.message),
  }
}
