/**
 * 건강 변화 리포트 — «🩺 건강검진 변화» 섹션 (두 검진 기록 비교 + 변화 큰 수치 추이 그래프)
 * 판정·정렬은 domain/checkup/compare.ts(순수) · 평가 IP/integration/health_report_checkup_compare_eval_v1.md
 * CHECKUP_ENABLED + 로그인일 때만. 검진 수치 해석은 참고용(진단 아님).
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CHECKUP_ENABLED } from '../../lib/flags'
import { getBiomarkerSeries, CHANGE_COLORS } from '../../domain/checkup/timeseries'
import { trendKeys, CHANGE_LABEL_KO } from '../../domain/checkup/compare'
import type { CheckupCompareState } from '../../lib/checkupCompare'
import TimeseriesChart from './TimeseriesChart'

function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : d
}

const card = { background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', border: '1px solid var(--border)' } as const

/** cc = useCheckupCompare() (페이지 소유). variant 'compact' = 검진 0·1건·오류일 때 아래쪽 한 줄 안내 */
export default function CheckupCompareSection({ cc, variant = 'full' }: { cc: CheckupCompareState; variant?: 'full' | 'compact' }) {
  const { state, data, beforeIdx, afterIdx, setBeforeIdx, setAfterIdx, cmp } = cc
  const trends = useMemo(() => (cmp ? trendKeys(cmp.rows, 5) : []), [cmp])

  if (!CHECKUP_ENABLED) return null
  if (state === 'off') return null

  if (variant === 'compact') {
    return (
      <div style={{ ...card, marginBottom: 'var(--space-5)', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        🩺 {state === 'error'
          ? '검진 기록을 불러오지 못했어요.'
          : !data || data.history.length === 0
            ? '건강검진 결과를 입력하면 검진 수치 변화도 함께 볼 수 있어요.'
            : `검진 결과가 1건(${fmtDate(data.history[0].recorded_date)}) 있어요. 다음 검진을 입력하면 수치 변화를 비교해 드려요.`}{' '}
        <Link to="/checkup" style={{ fontWeight: 600 }}>검진 결과 입력 →</Link>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 'var(--space-5)', textAlign: 'left' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span>🩺</span> 건강검진 변화{cmp ? <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}> · {fmtDate(cmp.beforeDate)} → {fmtDate(cmp.afterDate)}</span> : null}
      </h3>

      {state === 'loading' && <div style={card}><p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>검진 기록을 불러오는 중...</p></div>}
      {state === 'error' && <div style={card}><p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>검진 기록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p></div>}

      {state === 'ready' && data && data.history.length < 2 && (
        <div style={card}>
          <p style={{ margin: '0 0 var(--space-3)', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {data.history.length === 0
              ? '아직 입력한 건강검진 결과가 없어요. 검진 결과를 입력하면 다음 검진과 비교해 드려요.'
              : `검진 결과가 1건(${fmtDate(data.history[0].recorded_date)}) 있어요. 다음 검진 결과를 입력하면 변화를 비교해 드려요.`}
          </p>
          <Link to="/checkup" className="btn btn-primary" style={{ textDecoration: 'none' }}>검진 결과 입력하기</Link>
        </div>
      )}

      {state === 'ready' && data && data.history.length >= 2 && (
        <>
          <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            {([['이전 검진', beforeIdx, setBeforeIdx], ['이후 검진', afterIdx, setAfterIdx]] as const).map(([label, val, set]) => (
              <label key={label} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {label}
                <select value={val} onChange={(e) => set(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {data.history.map((p, i) => <option key={p.recorded_date + i} value={i}>{fmtDate(p.recorded_date)}</option>)}
                </select>
              </label>
            ))}
          </div>

          {!cmp && <div style={card}><p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>서로 다른 두 검진을 골라 주세요.</p></div>}

          {cmp && (
            <>
              {!data.sexKnown && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-2)' }}>성별 정보가 없어 정상 범위 판정은 생략했어요.</p>
              )}
              <div style={{ ...card, padding: 0, marginBottom: 'var(--space-3)' }}>
                {cmp.rows.map((r, i) => (
                  <div key={r.key} style={{ padding: 'var(--space-3) var(--space-4)', borderTop: i ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {r.prev} → <strong>{r.curr}</strong> {r.unit}
                        <span style={{ color: 'var(--text-muted)' }}> ({r.delta > 0 ? '+' : ''}{r.delta}, {r.changeRate > 0 ? '+' : ''}{r.changeRate}%)</span>
                        {r.currLabel && <span style={{ color: 'var(--text-muted)' }}> · {r.currLabel}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: CHANGE_COLORS[r.classification] }}>{CHANGE_LABEL_KO[r.classification]}</span>
                  </div>
                ))}
                {cmp.rows.length === 0 && <p style={{ margin: 0, padding: 'var(--space-4)', fontSize: 14, color: 'var(--text-secondary)' }}>두 검진에 함께 있는 수치가 없어요.</p>}
              </div>
              {data.egfr.derivedCount > 0 && cmp.rows.some((r) => r.key === 'egfr') && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-2)' }}>
                  eGFR 은 검진 크레아티닌·나이·성별로 계산한 추정값이에요(CKD-EPI 2021).{data.egfr.sexAssumed ? ' 성별 정보가 없어 더 낮게 나오는 쪽 값을 보여 드려요.' : ''}
                </p>
              )}
              {cmp.onlyOneSide > 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-3)' }}>한쪽 검진에만 있는 수치 {cmp.onlyOneSide}개는 비교에서 뺐어요.</p>
              )}

              {trends.length > 0 && data.history.length >= 2 && (
                <>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: 'var(--space-4) 0 var(--space-2)' }}>📈 변화가 큰 수치 추이 (전체 검진)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {trends.map((k) => {
                      const row = cmp.rows.find((r) => r.key === k)!
                      return (
                        <div key={k} style={card}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 'var(--space-2)' }}>{row.name}{row.unit ? ` (${row.unit})` : ''}</div>
                          <TimeseriesChart biomarker_key={k} label={row.name} history={getBiomarkerSeries(data.history, k)} ranges={data.ranges} height={160} />
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-3)' }}>
        검진 수치 비교는 참고용이며 진단이 아닙니다. 이상 소견은 의료진과 상담하세요.
      </p>
    </div>
  )
}
