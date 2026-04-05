interface Props {
  current: number
  total: number
}

const STEP_LABELS = ['기본 정보', '증상 체크', '건강 목표', '수면', '스트레스', '운동', '식습관', '음주/흡연', '영양제', '건강 상태']

export default function ProgressBar({ current, total }: Props) {
  const pct = Math.round((current / total) * 100)

  return (
    <div className="survey-progress">
      <div className="survey-progress-header">
        <span className="survey-progress-step">Q{current}. {STEP_LABELS[current - 1]}</span>
        <span className="survey-progress-pct">{pct}%</span>
      </div>
      <div className="survey-progress-bar">
        <div className="survey-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="survey-progress-dots">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`survey-dot ${i + 1 < current ? 'done' : ''} ${i + 1 === current ? 'active' : ''}`}>
            {i + 1 < current ? '✓' : i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}
