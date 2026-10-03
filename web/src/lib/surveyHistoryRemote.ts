/**
 * 설문 기록 — 로그인 사용자는 서버(survey_responses) 우선 (IO + 훅)
 * 순수 규칙: domain/survey/history.ts · 평가: IP/integration/survey_history_server_eval_v1.md
 * 첫 렌더는 이 브라우저 기록(local) → 로그인 확인 후 서버 기록으로 교체(깜빡임 최소). 비로그인 동작은 종전 그대로.
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getSurveyHistory } from './surveyHistory'
import { fetchSurveyResponsesWithAnswers } from './survey_api'
import { runRecommendation } from '../engine'
import { chooseHistory, serverRowsToHistory } from '../domain/survey/history'
import type { SurveyRecord } from '../types'

export async function loadSurveyHistory(): Promise<SurveyRecord[]> {
  const local = getSurveyHistory()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return chooseHistory({ loggedIn: false, serverOk: false, server: [], local })
    const res = await fetchSurveyResponsesWithAnswers(user.id, 20)
    const server = res.rows ? serverRowsToHistory(res.rows, runRecommendation) : []
    return chooseHistory({ loggedIn: true, serverOk: res.rows !== null, server, local })
  } catch {
    return local
  }
}

/** history: 최신순. loading: 서버 확인 중 */
export function useSurveyHistory(): { history: SurveyRecord[]; loading: boolean } {
  const [history, setHistory] = useState<SurveyRecord[]>(() => getSurveyHistory())
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    loadSurveyHistory().then((h) => {
      if (!alive) return
      setHistory(h)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])
  return { history, loading }
}
