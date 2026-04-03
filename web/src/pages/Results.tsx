import type { RecommendationResult, Supplement, ScoreBreakdown } from '../types'

interface Props {
  result: RecommendationResult | null
  error: string | null
  onRestart: () => void
}

export default function Results({ result, error, onRestart }: Props) {
  if (error) {
    return (
      <div className="fade-in" style={{ paddingTop: '15vh', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😥</div>
        <h2 style={{ marginBottom: 8 }}>분석에 실패했어요</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error}</p>
        <button className="btn btn-primary" onClick={onRestart} style={{ maxWidth: 300 }}>
          다시 시작하기
        </button>
      </div>
    )
  }

  if (!result) return null

  const { persona, recommendations, excluded, score_breakdown, nutrition_info, monthly_summary, warnings } = result

  return (
    <div className="fade-in" style={{ paddingTop: 24, paddingBottom: 60 }}>

      {/* 페르소나 카드 */}
      <div className="card card-elevated" style={{ textAlign: 'center', marginBottom: 24, background: 'linear-gradient(135deg, var(--primary-light), #f0f9ff)' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>{persona.emoji}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{persona.name}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>{persona.description}</p>
        <div className="alert alert-info" style={{ textAlign: 'left', marginBottom: 0 }}>
          💡 {persona.tip}
        </div>
      </div>

      {/* BMI + 영양 정보 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>📊 신체 분석</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: nutrition_info.bmi.color }}>{nutrition_info.bmi.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>BMI ({nutrition_info.bmi.label})</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{Math.round(nutrition_info.tdee)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>일일 에너지 (kcal)</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{nutrition_info.protein_min}~{nutrition_info.protein_max}g</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>단백질 목표</div>
          </div>
        </div>
      </div>

      {/* 경고 메시지 */}
      {warnings.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {warnings.map((w, i) => (
            <div key={i} className="alert alert-warning">⚠️ {w}</div>
          ))}
        </div>
      )}

      {/* 레이더 차트 대체: 점수 바 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🎯 카테고리별 필요도</h3>
        {score_breakdown
          .sort((a, b) => b.score - a.score)
          .filter(s => s.score > 0)
          .map((s: ScoreBreakdown) => (
            <div key={s.category} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{s.category}</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.score.toFixed(1)} / {s.max_score}</span>
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((s.score / s.max_score) * 100, 100)}%`,
                  background: s.score >= 7 ? 'var(--danger)' : s.score >= 4 ? 'var(--warning)' : 'var(--accent)',
                  borderRadius: 4,
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          ))}
      </div>

      {/* 추천 영양제 */}
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>💊 맞춤 추천 영양제</h3>
      {recommendations.map((supp: Supplement) => (
        <SupplementCard key={supp.id} supp={supp} />
      ))}

      {/* 월간 비용 요약 */}
      <div className="card" style={{ marginBottom: 24, background: 'var(--accent-light)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>💰 월간 예상 비용</h3>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
          ₩{monthly_summary.cost_min.toLocaleString()} ~ ₩{monthly_summary.cost_max.toLocaleString()}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          하루 {monthly_summary.pills_per_day}알 | {monthly_summary.items.map(i => i.name).join(', ')}
        </div>
      </div>

      {/* 제외된 후보 */}
      {excluded.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
            📋 차순위 후보 (이번엔 추천에서 빠졌어요)
          </h3>
          {excluded.map((supp: Supplement) => (
            <div key={supp.id} className="card" style={{ marginBottom: 12, opacity: 0.7 }}>
              <div style={{ fontWeight: 600 }}>{supp.name}</div>
              {supp.reason && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{supp.reason}</div>}
            </div>
          ))}
        </>
      )}

      {/* 다시 시작 */}
      <button className="btn btn-secondary" onClick={onRestart} style={{ marginTop: 24 }}>
        🔄 다시 분석하기
      </button>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 24 }}>
        본 추천은 식약처 인정 건강기능식품 기능성에 기반한 참고 정보이며, 의학적 진단을 대체하지 않습니다.
      </p>
    </div>
  )
}


/* ── 개별 영양제 카드 ── */
function SupplementCard({ supp }: { supp: Supplement }) {
  return (
    <div className="result-card">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span className="rank-badge">{supp.rank}</span>
        <span className="supp-name">{supp.name}</span>
      </div>

      {supp.mfds_function && (
        <span className="mfds-badge">식약처 인정: {supp.mfds_function}</span>
      )}

      {supp.evidence?.summary && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
          {supp.evidence.summary}
        </p>
      )}

      {supp.dosage_guide && (
        <div style={{ fontSize: 13, marginTop: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
          <strong>복용 가이드:</strong> {supp.dosage_guide.amount} | {supp.dosage_guide.timing} | {supp.dosage_guide.duration}
        </div>
      )}

      {(supp.cautions && supp.cautions.length > 0) && (
        <div style={{ fontSize: 12, color: '#92400e', marginTop: 8 }}>
          ⚠️ {supp.cautions.join(' / ')}
        </div>
      )}

      {(supp.food_avoid && supp.food_avoid.length > 0) && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          🚫 함께 피할 음식: {supp.food_avoid.join(', ')}
        </div>
      )}

      {supp.coupang_url && (
        <a href={supp.coupang_url} target="_blank" rel="noopener noreferrer" className="coupang-btn">
          🛒 쿠팡에서 최저가 보기
        </a>
      )}
    </div>
  )
}
