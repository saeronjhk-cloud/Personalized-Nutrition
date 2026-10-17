/**
 * 홈 개편 v1 — 재방문 판정용 데이터 (IO + 훅). 판정은 domain/home/home_mode.ts
 * 평가: IP/integration/home_redesign_v1_design.md · 오류는 «기록 없음»으로 처리(방문자 홈으로 안전하게)
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { CHECKUP_ENABLED, MEAL_ENABLED } from './flags'
import { startOfLocalDay } from './goalCoaching'

export interface HomeData {
  loading: boolean
  isLoggedIn: boolean
  /** 식사·검진 기록 존재(설문은 페이지가 useSurveyHistory 로 합산) */
  hasMealOrCheckup: boolean
  todayRows: { eaten_at: string; meal_slot: string | null }[]
  /** 가장 최근 검진일 YYYY-MM-DD(없으면 null) — 재검진 입력 안내(domain/checkup/recheck_prompt) */
  latestCheckupDate: string | null
}

const EMPTY: HomeData = { loading: false, isLoggedIn: false, hasMealOrCheckup: false, todayRows: [], latestCheckupDate: null }

export async function loadHomeData(): Promise<HomeData> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return EMPTY
    const [anyMeal, today, anyCheckup] = await Promise.all([
      MEAL_ENABLED ? supabase.from('meal_log').select('id').eq('user_id', uid).limit(1) : Promise.resolve({ data: [], error: null }),
      MEAL_ENABLED
        ? supabase.from('meal_log').select('eaten_at, meal_slot').eq('user_id', uid).gte('eaten_at', startOfLocalDay().toISOString()).limit(50)
        : Promise.resolve({ data: [], error: null }),
      CHECKUP_ENABLED
        ? supabase.from('checkup_records').select('recorded_date').eq('user_id', uid).is('deleted_at', null).order('recorded_date', { ascending: false }).limit(1)
        : Promise.resolve({ data: [], error: null }),
    ])
    const n = (r: { data: unknown[] | null; error: unknown }) => (r.error || !r.data ? 0 : r.data.length)
    return {
      loading: false,
      isLoggedIn: true,
      hasMealOrCheckup: n(anyMeal) + n(anyCheckup) > 0,
      todayRows: today.error || !today.data ? [] : (today.data as HomeData['todayRows']),
      latestCheckupDate: anyCheckup.error || !anyCheckup.data?.length ? null : String((anyCheckup.data[0] as { recorded_date?: unknown }).recorded_date ?? '') || null,
    }
  } catch {
    return EMPTY
  }
}

export function useHomeData(): HomeData {
  const [d, setD] = useState<HomeData>({ ...EMPTY, loading: true })
  useEffect(() => {
    let alive = true
    loadHomeData().then((x) => { if (alive) setD(x) })
    return () => { alive = false }
  }, [])
  return d
}

/**
 * Supabase 기본 저장소(localStorage `sb-<ref>-auth-token`)에 세션 흔적이 있는지 — 동기 확인.
 * 첫 렌더에서 «방문자 홈을 바로 그릴지 / 자리 표시로 기다릴지»만 정한다(로그인 판정 자체는 loadHomeData).
 * 저장소 접근 예외 → false(기존 동작 = 방문자 홈). 평가 IP/integration/home_first_render_eval_v1.md P11
 */
export function hasStoredSession(storage: Pick<Storage, 'length' | 'key'> | null | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined): boolean {
  try {
    if (!storage) return false
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && /^sb-.+-auth-token$/.test(k)) return true
    }
    return false
  } catch {
    return false
  }
}

/** 첫 렌더 판정 대기 상한(ms). 넘으면 그 시점 정보로 판정(무한 자리 표시 금지). */
export const HOME_PENDING_TIMEOUT_MS = 4000
