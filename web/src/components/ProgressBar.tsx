interface Props {
  current: number
  total: number
}

export default function ProgressBar({ current, total }: Props) {
  const pct = Math.round((current / total) * 100)
  return (
    <>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="step-label">Q{current} / {total}</div>
    </>
  )
}
