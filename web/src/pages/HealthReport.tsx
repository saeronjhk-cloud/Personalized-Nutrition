import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { SurveyRecord, ScoreBreakdown } from '../types'
import { getSurveyHistory } from '../lib/surveyHistory'

/** 날짜를 "2026년 4월 16일" 형태로 */
function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 두 날짜 사이의 일수 */
function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

/** 점수 변화에 따른 라벨 */
function changeLabel(diff: number): { text: string; color: string; emoji: string } {
  if (diff <= -3) return { text: '크게 개선', color: 'var(--success)', emoji: '🎉' }
  if (diff <= -1) return { text: '개선됨', color: 'var(--success)', emoji: '✅' }
  if (diff < 1) return { text: '유지', color: 'var(--text-secondary)', emoji: '➖' }
  if (diff < 3) return { text: '주의 필요', color: 'var(--warning)', emoji: '⚠️' }
  return { text: '악화', color: 'var(--danger)', emoji: '🔴' }
}

export default function HealthReport() {
  const [history, setHistory] = useState<SurveyRecord[]>([])
  const [beforeIdx, setBeforeIdx] = useState(0)
  const [afterIdx, setAfterIdx] = useState(0)

  useEffect(() => {
    const records = getSurveyHistory()
    setHistory(records)
    if (records.length >= 2) {
      // 기본: 가장 오래된 것 vs 가장 최근 것
      setBeforeIdx(records.length - 1)
      setAfterIdx(0)
    }
  }, [])

  if (history.length < 2) {
    return (
      <div className="page fade-in" style={{ paddingTop: '12vh', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
        <h2 style={{ marginBottom: 'var(--space-3)' }}>건강 변화 리포트</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', lineHeight: 1.7 }}>
          비교 분석을 하려면 최소 2번의 설문이 필요해요.<br />
          건강기능식품을 섭취하시고 일정 기간 후에<br />
          다시 설문을 진행해주세요.
        </p>
        <Link to="/survey" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          설문 시작하기
        </Link>
      </div>
    )
  }

  const before = history[beforeIdx]
  const after = history[afterIdx]
  const days = daysBetween(before.date, after.date)

  // 카테고리별 점수 비교
  const beforeScores = new Map(before.result.score_breakdown.map(s => [s.category, s]))
  const afterScores = new Map(after.result.score_breakdown.map(s => [s.category, s]))
  const allCategories = Array.from(new Set([
    ...before.result.score_breakdown.map(s => s.category),
    ...after.result.score_breakdown.map(s => s.category),
  ]))

  // 점수 비교 데이터 (필요도 점수이므로 감소 = 개선)
  const comparisons = allCategories
    .map(cat => {
      const bScore = beforeScores.get(cat)?.score ?? 0
      const aScore = afterScores.get(cat)?.score ?? 0
      const maxScore = beforeScores.get(cat)?.max_score ?? afterScores.get(cat)?.max_score ?? 10
      const diff = aScore - bScore // 음수 = 개선됨
      return { category: cat, before: bScore, after: aScore, maxScore, diff, ...changeLabel(diff) }
    })
    .sort((a, b) => a.diff - b.diff) // 가장 많이 개선된 것부터

  // 영양제 변화 분석
  const beforeSupps = new Set(before.result.recommendations.map(r => r.name))
  const afterSupps = new Set(after.result.recommendations.map(r => r.name))
  const removedSupps = [...beforeSupps].filter(s => !afterSupps.has(s))
  const addedSupps = [...afterSupps].filter(s => !beforeSupps.has(s))
  const keptSupps = [...beforeSupps].filter(s => afterSupps.has(s))

  // 증상 변화
  const beforeSymptoms = new Set(before.answers.증상 || [])
  const afterSymptoms = new Set(after.answers.증상 || [])
  const resolvedSymptoms = [...beforeSymptoms].filter(s => !afterSymptoms.has(s))
  const newSymptoms = [...afterSymptoms].filter(s => !beforeSymptoms.has(s))

  // 총점 변화
  const totalBefore = before.result.score_breakdown.reduce((sum, s) => sum + s.score, 0)
  const totalAfter = after.result.score_breakdown.reduce((sum, s) => sum + s.score, 0)
  const totalDiff = totalAfter - totalBefore
  const overallLabel = changeLabel(totalDiff)

  // 비용 변화
  const costBefore = before.result.monthly_summary.cost_min
  const costAfter = after.result.monthly_summary.cost_min

  return (
    <div className="page fade-in" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: 'var(--space-5) var(--space-4) var(--space-8)' }}>

      {/* 헤더 */}
      <div style={{
        textAlign: 'center',
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-6) var(--space-4)',
        background: 'linear-gradient(135deg, var(--primary-light) 0%, #f0fdf4 100%)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 'var(--space-2)' }}>📊</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 'var(--space-1)' }}>건강 변화 리포트</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {formatDate(before.date)} → {formatDate(after.date)} ({days}일 경과)
        </p>
      </div>

      {/* 기간 선택 (기록이 3개 이상일 때) */}
      {history.length >= 3 && (
        <div style={{
          display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)',
          background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-3) var(--space-4)', border: '1px solid var(--border)',
        }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>이전</label>
            <select
              value={beforeIdx}
              onChange={e => setBeforeIdx(Number(e.target.value))}
              style={{ width: '100%', padding: 'var(--space-2) var(--space-2)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
            >
              {history.map((r, i) => (
                <option key={r.id} value={i} disabled={i === afterIdx}>
                  {formatDate(r.date)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>이후</label>
            <select
              value={afterIdx}
              onChange={e => setAfterIdx(Number(e.target.value))}
              style={{ width: '100%', padding: 'var(--space-2) var(--space-2)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
            >
              {history.map((r, i) => (
                <option key={r.id} value={i} disabled={i === beforeIdx}>
                  {formatDate(r.date)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 종합 요약 카드 */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-5)',
        marginBottom: 'var(--space-5)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 36, marginBottom: 'var(--space-1)' }}>{overallLabel.emoji}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: overallLabel.color }}>
            {totalDiff < 0 ? '전반적으로 개선되었어요!' : totalDiff === 0 ? '전반적으로 유지되고 있어요' : '일부 관리가 필요해요'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>건강 유형</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {before.result.persona.emoji} → {after.result.persona.emoji}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {before.result.persona.name === after.result.persona.name
                ? '유지' : after.result.persona.name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>필요 영양제</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {before.result.recommendations.length}종 → {after.result.recommendations.length}종
            </div>
            <div style={{ fontSize: 11, color: after.result.recommendations.length < before.result.recommendations.length ? 'var(--success)' : 'var(--text-secondary)' }}>
              {after.result.recommendations.length < before.result.recommendations.length
                ? `${before.result.recommendations.length - after.result.recommendations.length}종 감소`
                : after.result.recommendations.length === before.result.recommendations.length
                  ? '변화 없음'
                  : `${after.result.recommendations.length - before.result.recommendations.length}종 증가`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>월 비용</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {costAfter < costBefore ? '↓' : costAfter > costBefore ? '↑' : '='}
            </div>
            <div style={{ fontSize: 11, color: costAfter < costBefore ? 'var(--success)' : 'var(--text-secondary)' }}>
              ₩{costAfter.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 카테고리별 변화 */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span>🎯</span> 카테고리별 변화
        </h3>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {comparisons.filter(c => c.before > 0 || c.after > 0).map((c, i) => (
            <div key={c.category} style={{
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: i < comparisons.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{c.category}</span>
                <span style={{ fontSize: 12, color: c.color, fontWeight: 600 }}>
                  {c.emoji} {c.text}
                </span>
              </div>
              {/* 이전/이후 바 비교 */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>이전</span>
                <div style={{ flex: 1, background: 'var(--border-light)', borderRadius: 'var(--radius-xs)', height: 8 }}>
                  <div style={{
                    width: `${Math.min((c.before / c.maxScore) * 100, 100)}%`,
                    height: '100%',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--text-muted)',
                    opacity: 0.5,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 24 }}>{c.before.toFixed(1)}</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-1)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>이후</span>
                <div style={{ flex: 1, background: 'var(--border-light)', borderRadius: 'var(--radius-xs)', height: 8 }}>
                  <div style={{
                    width: `${Math.min((c.after / c.maxScore) * 100, 100)}%`,
                    height: '100%',
                    borderRadius: 'var(--radius-xs)',
                    background: c.diff <= -1 ? 'var(--success)' : c.diff >= 1 ? 'var(--warning)' : 'var(--accent)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, color: c.color, fontWeight: 600, width: 24 }}>{c.after.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
          * 필요도 점수가 낮을수록 해당 영역의 건강 상태가 양호합니다
        </p>
      </div>

      {/* 증상 변화 */}
      {(resolvedSymptoms.length > 0 || newSymptoms.length > 0) && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span>🩺</span> 증상 변화
          </h3>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-4)',
            border: '1px solid var(--border)',
          }}>
            {resolvedSymptoms.length > 0 && (
              <div style={{ marginBottom: newSymptoms.length > 0 ? 12 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginBottom: 'var(--space-2)' }}>
                  ✅ 개선된 증상
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {resolvedSymptoms.map(s => (
                    <span key={s} style={{
                      background: 'var(--success-bg)',
                      color: '#065f46',
                      fontSize: 12,
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 20,
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {newSymptoms.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 'var(--space-2)' }}>
                  ⚠️ 새로 나타난 증상
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {newSymptoms.map(s => (
                    <span key={s} style={{
                      background: 'var(--warning-bg)',
                      color: '#92400e',
                      fontSize: 12,
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 20,
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 영양제 변화 */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span>💊</span> 영양제 변화
        </h3>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-4)',
          border: '1px solid var(--border)',
        }}>
          {removedSupps.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginBottom: 'var(--space-2)' }}>
                더 이상 필요 없는 영양제
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {removedSupps.map(s => (
                  <span key={s} style={{
                    background: 'var(--success-bg)',
                    color: '#065f46',
                    fontSize: 12,
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 20,
                    textDecoration: 'line-through',
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {addedSupps.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 'var(--space-2)' }}>
                새롭게 추천된 영양제
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {addedSupps.map(s => (
                  <span key={s} style={{
                    background: 'var(--warning-bg)',
                    color: '#92400e',
                    fontSize: 12,
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 20,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {keptSupps.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                계속 복용 권장
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {keptSupps.map(s => (
                  <span key={s} style={{
                    background: 'var(--border-light)',
                    color: 'var(--text)',
                    fontSize: 12,
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 20,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {removedSupps.length === 0 && addedSupps.length === 0 && keptSupps.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
              영양제 추천에 변화가 없습니다
            </p>
          )}
        </div>
      </div>

      {/* 신체 변화 (체중/BMI) */}
      {(before.answers.체중 !== after.answers.체중 || before.result.nutrition_info.bmi.value !== after.result.nutrition_info.bmi.value) && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span>⚖️</span> 신체 변화
          </h3>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-4)',
            border: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-4)',
            textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>체중</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 'var(--space-1)' }}>
                {before.answers.체중}kg → {after.answers.체중}kg
              </div>
              <div style={{ fontSize: 12, color: after.answers.체중 < before.answers.체중 ? 'var(--success)' : 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                {after.answers.체중 - before.answers.체중 > 0 ? '+' : ''}{(after.answers.체중 - before.answers.체중).toFixed(1)}kg
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>BMI</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 'var(--space-1)' }}>
                {before.result.nutrition_info.bmi.value} → {after.result.nutrition_info.bmi.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                {after.result.nutrition_info.bmi.label}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
        <Link to="/survey" style={{
          display: 'inline-block',
          background: 'var(--primary)',
          color: '#fff',
          padding: 'var(--space-3) var(--space-8)',
          borderRadius: 'var(--radius-sm)',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 15,
        }}>
          🔄 다시 분석하기
        </Link>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
          정기적으로 분석하면 건강 변화를 더 정확히 추적할 수 있어요
        </p>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 'var(--space-6)' }}>
        본 리포트는 설문 응답 기반 참고 정보이며, 의학적 진단을 대체하지 않습니다.
      </p>
    </div>
  )
}
