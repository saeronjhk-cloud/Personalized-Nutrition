import { useState, useEffect, useCallback } from 'react'
import { fetchWeeklyReport, markWeeklyViewed } from '../lib/weeklyReport'
import { track } from '../lib/events'
import {
  lastCompletedWeekStart, prevWeek, nextWeek, isAfterLastCompleted,
  formatWeekRange, flagView, coverageCaption, isInsufficient, weeklyRenderModel,
  WeeklyReportError, type WeeklyReport as WR,
} from '../lib/weeklyReport_view'

/** 주간 리포트 — 엔진 룰(report.v1) 결과 조회·렌더. 4요소: 음식군/영양 flags/다음 행동/p2. */
export default function WeeklyReport() {
  const [weekStart, setWeekStart] = useState<string>(() => lastCompletedWeekStart())
  const [data, setData] = useState<WR | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null)

  const load = useCallback(async (ws: string, force = false) => {
    setLoading(true); setError(null)
    try {
      const r = await fetchWeeklyReport(ws, force)
      setData(r)
      track('weekly_report_view', { cached: r.cached, has_data: !isInsufficient(r.report) })
      // 최초 열람 기록(비차단)
      markWeeklyViewed(r.report_id, r.first_viewed_at).catch(() => {})
    } catch (e) {
      const we = e as WeeklyReportError
      setError({ message: we.message || '리포트를 불러오지 못했어요', retryable: !!we.retryable })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(weekStart) }, [weekStart, load])

  const canNext = !isAfterLastCompleted(nextWeek(weekStart))
  const report = data?.report
  const vm = weeklyRenderModel({ loading, error, data })

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 48px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '4px 0 2px' }}>주간 식사 리포트</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        한 주 식사 기록을 영양 기준으로 정리했어요.
      </p>

      {/* 주간 네비 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
        <button type="button" className="btn btn-secondary" style={navBtn} aria-label="이전 주"
          onClick={() => setWeekStart((w) => prevWeek(w))}>‹</button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{formatWeekRange(weekStart)}</div>
          {vm.cached && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>저장된 리포트</div>}
        </div>
        <button type="button" className="btn btn-secondary" style={{ ...navBtn, opacity: canNext ? 1 : 0.35 }}
          aria-label="다음 주" disabled={!canNext} onClick={() => canNext && setWeekStart((w) => nextWeek(w))}>›</button>
      </div>

      {vm.mode === 'loading' && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>불러오는 중…</div>}

      {vm.mode === 'error' && error && (
        <div style={{ ...card, borderColor: 'var(--danger)' }}>
          <div style={{ color: 'var(--danger)', fontWeight: 700, marginBottom: 6 }}>리포트를 불러오지 못했어요</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: vm.errorRetryable ? 12 : 0 }}>{error.message}</div>
          {vm.errorRetryable && (
            <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px' }}
              onClick={() => load(weekStart, true)}>다시 시도</button>
          )}
        </div>
      )}

      {(vm.mode === 'insufficient' || vm.mode === 'report') && report && (
        <>
          {/* coverage */}
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            {coverageCaption(report.coverage)}
          </div>

          {vm.mode === 'insufficient' ? (
            <div style={card}>
              <div style={{ fontSize: 15, color: 'var(--text)' }}>{report.next_action.message}</div>
            </div>
          ) : (
            <>
              {/* 1) 음식군 칩 */}
              {vm.showFoodGroups && (
                <section style={{ marginBottom: 18 }}>
                  <div style={sectionTitle}>이번 주 자주 먹은 음식</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {report.top_food_groups.map((g) => (
                      <span key={g.name} style={chip}>{g.name} <span style={{ opacity: 0.6 }}>{g.count}</span></span>
                    ))}
                  </div>
                </section>
              )}

              {/* 2) 영양 균형 flags */}
              <section style={{ marginBottom: 18 }}>
                <div style={sectionTitle}>영양 균형</div>
                {vm.showFlagsSuccess ? (
                  <div style={{ ...card, borderColor: 'var(--success)' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>균형이 잘 잡힌 한 주였어요 ✓</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {report.macro_balance.flags.map((f, i) => {
                      const v = flagView(f)
                      return (
                        <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                          <span style={{ color: v.colorVar, fontWeight: 800, fontSize: 16 }}>{v.arrow}</span>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{v.label}</span>
                          {typeof f.avg === 'number' && (
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                              일평균 {f.avg}{f.ref != null ? ` / 기준 ${f.ref}` : ''}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* 3) 다음 행동 */}
              <section style={{ marginBottom: 18 }}>
                <div style={sectionTitle}>다음 주 제안</div>
                <div style={{ ...card, background: 'var(--surface-2, rgba(0,0,0,0.03))' }}>
                  <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.5 }}>{report.next_action.message}</div>
                </div>
              </section>

              {/* 4) p2 티저 */}
              {vm.showP2 && (
                <div style={{ ...card, fontSize: 13, color: 'var(--text-muted)' }}>
                  💡 {report.p2_teaser.message}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = { width: 40, minWidth: 40, padding: '8px 0', fontSize: 18, lineHeight: 1 }
const card: React.CSSProperties = {
  border: '1px solid var(--border, rgba(0,0,0,0.1))', borderRadius: 12, padding: '14px 16px', background: 'var(--surface, #fff)',
}
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }
const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 999,
  background: 'var(--surface-2, rgba(0,0,0,0.05))', color: 'var(--text)', fontSize: 14, fontWeight: 600,
}
