/**
 * 건강 변화 리포트 — 검진 비교 데이터·선택 상태 (IO + 훅). 페이지가 소유해서 종합 요약과 검진 섹션이 같은 비교를 씀.
 * 순수 판정: domain/checkup/compare.ts · 평가 IP/integration/health_report_checkup_compare_eval_v1.md · health_report_layout_v2_eval.md
 */
import { useEffect, useMemo, useState } from 'react'
import { CHECKUP_ENABLED } from './flags'
import { fetchMyProfile, fetchCheckupHistory, fetchBiomarkerRules, fetchRanges } from './checkup_api'
import { normalizeHistory, type HistoryPoint } from '../domain/checkup/timeseries'
import { compareCheckups, type CheckupComparison, type CheckupRuleLite } from '../domain/checkup/compare'
import type { Range } from '../domain/checkup/engine'
import type { CheckupLoadState } from '../domain/survey/report'

export interface CheckupData { history: HistoryPoint[]; ranges: Range[]; rules: CheckupRuleLite[]; sexKnown: boolean }

export interface CheckupCompareState {
  state: CheckupLoadState
  data: CheckupData | null
  beforeIdx: number
  afterIdx: number
  setBeforeIdx: (i: number) => void
  setAfterIdx: (i: number) => void
  cmp: CheckupComparison | null
}

export function useCheckupCompare(): CheckupCompareState {
  const [state, setState] = useState<CheckupLoadState>(CHECKUP_ENABLED ? 'loading' : 'off')
  const [data, setData] = useState<CheckupData | null>(null)
  const [beforeIdx, setBeforeIdx] = useState(0)
  const [afterIdx, setAfterIdx] = useState(0)

  useEffect(() => {
    if (!CHECKUP_ENABLED) return
    let alive = true
    ;(async () => {
      try {
        const prof = await fetchMyProfile()
        if (!prof.isLoggedIn || !prof.userId) { if (alive) setState('off'); return }
        const sex = prof.profile?.sex === 'M' || prof.profile?.sex === 'F' ? prof.profile.sex : null
        const [h, rules, ranges] = await Promise.all([
          fetchCheckupHistory(prof.userId),
          fetchBiomarkerRules(),
          sex ? fetchRanges(sex) : Promise.resolve({ ranges: [], error: null }),
        ])
        if (!alive) return
        if (h.error) { setState('error'); return }
        const history = normalizeHistory(h.history)
        setData({ history, ranges: (ranges.ranges ?? []) as Range[], rules: rules.data ?? [], sexKnown: sex !== null })
        setBeforeIdx(0)
        setAfterIdx(Math.max(0, history.length - 1))
        setState('ready')
      } catch {
        if (alive) setState('error')
      }
    })()
    return () => { alive = false }
  }, [])

  const cmp = useMemo(
    () => (data ? compareCheckups(data.history, beforeIdx, afterIdx, data.ranges, data.rules) : null),
    [data, beforeIdx, afterIdx],
  )
  return { state, data, beforeIdx, afterIdx, setBeforeIdx, setAfterIdx, cmp }
}
