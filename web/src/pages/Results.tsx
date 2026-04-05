import { useEffect } from 'react'
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

  // 누적 분석 건수 카운터 증가
  useEffect(() => {
    if (result) {
      const current = parseInt(localStorage.getItem('analysis_count') || '847', 10)
      localStorage.setItem('analysis_count', String(current + 1))
    }
  }, [result])

  if (!result) return null

  const { persona, recommendations, excluded, score_breakdown, nutrition_info, monthly_summary, warnings } = result

  const handleSavePDF = () => {
    window.print()
  }

  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

  return (
    <div className="results-page fade-in">

      {/* 인쇄 전용 헤더 (화면에서는 숨김) */}
      <div className="print-header">
        <h1>🧬 서박사의 영양공식 맞춤 분석 리포트</h1>
        <p>{dateStr} 기준 | 서박사의 영양공식 by 새론비즈</p>
      </div>

      {/* PDF 저장 버튼 */}
      <div className="no-print" style={{ marginBottom: 20 }}>
        <button className="btn-pdf" onClick={handleSavePDF}>
          📄 결과를 PDF로 저장하기
        </button>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          저장 화면에서 "PDF로 저장"을 선택하세요
        </p>
      </div>

      {/* 결과 헤더 */}
      <div className="results-header">
        <div className="results-header-badge">분석 완료</div>
        <h1 className="results-header-title">맞춤 영양제 리포트</h1>
        <p className="results-header-date">{dateStr} 기준</p>
      </div>

      {/* 페르소나 카드 */}
      <div className="results-persona-card">
        <div className="results-persona-emoji">{persona.emoji}</div>
        <div className="results-persona-info">
          <div className="results-persona-label">나의 건강 유형</div>
          <h2 className="results-persona-name">{persona.name}</h2>
          <p className="results-persona-desc">{persona.description}</p>
        </div>
        {(persona.tip || persona.tagline) && (
          <div className="results-persona-tip">
            💡 {persona.tip || persona.tagline}
          </div>
        )}
      </div>

      {/* 신체 분석 */}
      <div className="results-section-title">
        <span className="results-section-icon">📊</span>
        신체 분석
      </div>
      <div className="results-body-grid">
        <div className="results-body-item">
          <div className="results-body-value" style={{ color: nutrition_info.bmi.color }}>{nutrition_info.bmi.value}</div>
          <div className="results-body-label">BMI</div>
          <div className="results-body-sub">{nutrition_info.bmi.label}</div>
        </div>
        <div className="results-body-item">
          <div className="results-body-value">{Math.round(nutrition_info.tdee)}</div>
          <div className="results-body-label">일일 에너지</div>
          <div className="results-body-sub">kcal</div>
        </div>
        <div className="results-body-item">
          <div className="results-body-value">{nutrition_info.protein_min}~{nutrition_info.protein_max}g</div>
          <div className="results-body-label">단백질 목표</div>
          <div className="results-body-sub">일일 권장량</div>
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

      {/* 카테고리별 필요도 */}
      <div className="results-section-title">
        <span className="results-section-icon">🎯</span>
        카테고리별 필요도
      </div>
      <div className="results-scores-card">
        {score_breakdown
          .sort((a, b) => b.score - a.score)
          .filter(s => s.score > 0)
          .map((s: ScoreBreakdown) => (
            <div key={s.category} className="results-score-row">
              <div className="results-score-header">
                <span className="results-score-name">{s.category}</span>
                <span className="results-score-value">{s.score.toFixed(1)}<span className="results-score-max">/{s.max_score}</span></span>
              </div>
              <div className="results-score-bar">
                <div className="results-score-fill" style={{
                  width: `${Math.min((s.score / s.max_score) * 100, 100)}%`,
                  background: s.score >= 7 ? 'var(--danger)' : s.score >= 4 ? 'var(--warning)' : 'var(--accent)',
                }} />
              </div>
            </div>
          ))}
      </div>

      {/* 추천 영양제 */}
      <div className="results-section-title">
        <span className="results-section-icon">💊</span>
        맞춤 추천 영양제
        <span className="results-section-count">{recommendations.length}종</span>
      </div>
      {recommendations.map((supp: Supplement) => (
        <SupplementCard key={supp.id} supp={supp} />
      ))}

      {/* 월간 비용 */}
      <div className="results-cost-card">
        <div className="results-cost-header">
          <span className="results-section-icon">💰</span>
          <span>월간 예상 비용</span>
        </div>
        <div className="results-cost-amount">
          ₩{monthly_summary.cost_min.toLocaleString()} ~ ₩{monthly_summary.cost_max.toLocaleString()}
        </div>
        <div className="results-cost-detail">
          하루 {monthly_summary.pills_per_day}알 | {monthly_summary.items.map(i => i.name).join(', ')}
        </div>
      </div>

      {/* 차순위 후보 */}
      {excluded.length > 0 && (
        <div className="results-excluded">
          <div className="results-section-title" style={{ fontSize: 15 }}>
            <span className="results-section-icon">📋</span>
            차순위 후보
          </div>
          <p className="results-excluded-desc">이번엔 추천에서 빠졌지만, 상황에 따라 고려할 수 있어요</p>
          {excluded.map((supp: Supplement) => (
            <div key={supp.id} className="results-excluded-item">
              <span className="results-excluded-name">{supp.name}</span>
              {supp.reason && <span className="results-excluded-reason">{supp.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {/* 다시 시작 */}
      <div className="no-print">
        <button className="btn btn-secondary" onClick={onRestart} style={{ marginTop: 24 }}>
          🔄 다시 분석하기
        </button>
      </div>

      <p className="disclaimer-text" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 24 }}>
        본 추천은 식약처 인정 건강기능식품 기능성에 기반한 참고 정보이며, 의학적 진단을 대체하지 않습니다.
      </p>
    </div>
  )
}


function SupplementCard({ supp }: { supp: Supplement }) {
  return (
    <div className="result-card-v2">
      <div className="result-card-header">
        <span className="result-card-rank">{supp.rank}</span>
        <div className="result-card-name-wrap">
          <span className="result-card-name">{supp.name}</span>
          {supp.mfds_function && (
            <span className="result-card-mfds">식약처 인정: {supp.mfds_function}</span>
          )}
        </div>
      </div>

      {supp.evidence?.summary && (
        <p className="result-card-evidence">{supp.evidence.summary}</p>
      )}

      {supp.dosage_guide && (
        <div className="result-card-dosage">
          <div className="result-card-dosage-item">
            <span className="result-card-dosage-label">용량</span>
            <span>{supp.dosage_guide.amount}</span>
          </div>
          <div className="result-card-dosage-item">
            <span className="result-card-dosage-label">복용 시점</span>
            <span>{supp.dosage_guide.timing}</span>
          </div>
          <div className="result-card-dosage-item">
            <span className="result-card-dosage-label">기간</span>
            <span>{supp.dosage_guide.duration}</span>
          </div>
        </div>
      )}

      {(supp.cautions && supp.cautions.length > 0) && (
        <div className="result-card-caution">⚠️ {supp.cautions.join(' / ')}</div>
      )}

      {(supp.food_avoid && supp.food_avoid.length > 0) && (
        <div className="result-card-avoid">🚫 함께 피할 음식: {supp.food_avoid.join(', ')}</div>
      )}

      {supp.coupang_url && (
        <a href={supp.coupang_url} target="_blank" rel="noopener noreferrer" className="coupang-btn">
          🛒 쿠팡에서 최저가 보기
        </a>
      )}
    </div>
  )
}
