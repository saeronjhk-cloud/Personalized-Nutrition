/**
 * 주간 리포트 client — Edge(weekly-report) 소비. 순수 로직은 weeklyReport_view.ts.
 * 서버가 canonical(엔진 룰). 앱은 조회·렌더·열람기록(first_viewed_at)만.
 */
import { supabase } from './supabase'
import { parseWeeklyEnvelope, type WeeklyReport } from './weeklyReport_view'

const BASE = import.meta.env.VITE_SUPABASE_URL || ''
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export function weeklyReportConfigured(): boolean { return !!BASE && !!ANON }

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('로그인이 필요합니다')
  return { Authorization: `Bearer ${token}`, apikey: ANON }
}

/** 특정 주(기본 최근 완결 주) 리포트 조회. force면 캐시 무시 재생성. */
export async function fetchWeeklyReport(weekStart?: string, force = false): Promise<WeeklyReport> {
  const qs = new URLSearchParams()
  if (weekStart) qs.set('week_start', weekStart)
  if (force) qs.set('force', '1')
  const url = `${BASE}/functions/v1/weekly-report${qs.toString() ? `?${qs}` : ''}`
  const res = await fetch(url, { headers: await authHeaders() })
  const json = await res.json().catch(() => ({}))
  return parseWeeklyEnvelope(json)
}

/** 최초 열람 기록(first_viewed_at). 이미 있으면 no-op. RLS: 본인 update. */
export async function markWeeklyViewed(reportId: string, currentFirstViewed: string | null): Promise<void> {
  if (currentFirstViewed) return
  await supabase.from('weekly_report')
    .update({ first_viewed_at: new Date().toISOString() })
    .eq('id', reportId)
    .is('first_viewed_at', null)
}
