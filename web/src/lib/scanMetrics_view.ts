/**
 * 익명 퍼널 대시보드 순수 뷰 로직 (get_scan_metrics RPC 소비 — supabase 비의존, 테스트 대상).
 * RPC 계약: IP phase_p15(scan) + IP100(by_surface/meal/report surface 확장).
 * 개인 식별자 없음 · props 화이트리스트(PII 차단) · k-익명성은 top_categories에만.
 */

// ── RPC 계약 타입 ─────────────────────────────────────────────────
export interface MealFunnel {
  visits: number; consent_shown: number; consent_accepted: number; capture_start: number
  analyze_success: number; analyze_error: number; saved: number
  session_start: number; session_close: number; leftover_open: number; leftover_apply: number
}
export interface ScanMetrics {
  generated_at: string
  window_days: number
  k_min: number
  by_event: Record<string, number>
  by_surface: Record<string, number>
  visits: number
  lookup_success: number
  lookup_not_found: number
  survey_cta_clicks: number
  top_categories: { name: string; n: number }[]
  meal: MealFunnel
  report: { weekly_views: number }
}

// ── 표시 모델 ─────────────────────────────────────────────────────
export interface FunnelStep {
  label: string
  n: number
  /** 기준(첫 스텝) 대비 전환율 %. 기준이 0이면 null. 첫 스텝은 100(기준>0) 또는 null. */
  pct: number | null
}
export interface SurfacePanel {
  surface: 'scan' | 'meal' | 'report'
  title: string
  total: number      // by_surface 총 이벤트 수
  steps: FunnelStep[]
  empty: boolean     // 이 surface에 이벤트 0
}

function n(v: unknown): number { return typeof v === 'number' && isFinite(v) ? v : 0 }
function pctOf(value: number, base: number): number | null {
  if (base <= 0) return null
  return Math.round((value / base) * 100)
}
/** 첫 스텝을 기준으로 각 스텝의 전환율 부여. */
function withPct(steps: { label: string; n: number }[]): FunnelStep[] {
  const base = steps.length ? steps[0].n : 0
  return steps.map((s, i) => ({
    label: s.label,
    n: s.n,
    pct: i === 0 ? (base > 0 ? 100 : null) : pctOf(s.n, base),
  }))
}

export function scanPanel(m: ScanMetrics): SurfacePanel {
  const total = n(m.by_surface?.scan)
  const steps = withPct([
    { label: '방문(페이지뷰)', n: n(m.visits) },
    { label: '조회 성공', n: n(m.lookup_success) },
    { label: '조회 실패(미발견)', n: n(m.lookup_not_found) },
    { label: '설문 CTA 클릭', n: n(m.survey_cta_clicks) },
  ])
  return { surface: 'scan', title: '스캔 퍼널', total, steps, empty: total === 0 }
}

export function mealPanel(m: ScanMetrics): SurfacePanel {
  const mm = m.meal ?? ({} as MealFunnel)
  const total = n(m.by_surface?.meal)
  const steps = withPct([
    { label: '방문', n: n(mm.visits) },
    { label: '동의 수락', n: n(mm.consent_accepted) },
    { label: '촬영 시작', n: n(mm.capture_start) },
    { label: '분석 성공', n: n(mm.analyze_success) },
    { label: '저장', n: n(mm.saved) },
  ])
  return { surface: 'meal', title: '식사기록 퍼널', total, steps, empty: total === 0 }
}

export function reportPanel(m: ScanMetrics): SurfacePanel {
  const total = n(m.by_surface?.report)
  const steps = withPct([{ label: '주간 리포트 열람', n: n(m.report?.weekly_views) }])
  return { surface: 'report', title: '주간 리포트', total, steps, empty: total === 0 }
}

/** scan/meal/report 3패널. metrics 없으면 빈 배열. */
export function buildPanels(m: ScanMetrics | null | undefined): SurfacePanel[] {
  if (!m) return []
  return [scanPanel(m), mealPanel(m), reportPanel(m)]
}

/** 보조 지표: 분석 성공률(성공/(성공+실패)), 저장 전환(저장/방문). null=기준0. */
export function mealHealth(m: ScanMetrics): { analyzeSuccessRate: number | null; saveConversion: number | null } {
  const mm = m.meal ?? ({} as MealFunnel)
  const attempts = n(mm.analyze_success) + n(mm.analyze_error)
  return {
    analyzeSuccessRate: pctOf(n(mm.analyze_success), attempts),
    saveConversion: pctOf(n(mm.saved), n(mm.visits)),
  }
}
