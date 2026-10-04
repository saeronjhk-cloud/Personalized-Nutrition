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
}

const EMPTY: HomeData = { loading: false, isLoggedIn: false, hasMealOrCheckup: false, todayRows: [] }

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
        ? supabase.from('checkup_records').select('id').eq('user_id', uid).is('deleted_at', null).limit(1)
        : Promise.resolve({ data: [], error: null }),
    ])
    const n = (r: { data: unknown[] | null; error: unknown }) => (r.error || !r.data ? 0 : r.data.length)
    return {
      loading: false,
      isLoggedIn: true,
      hasMealOrCheckup: n(anyMeal) + n(anyCheckup) > 0,
      todayRows: today.error || !today.data ? [] : (today.data as HomeData['todayRows']),
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
