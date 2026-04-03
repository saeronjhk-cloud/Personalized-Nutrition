export default function Loading() {
  return (
    <div className="loading-container fade-in">
      <div className="spinner" />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
          맞춤 분석 중...
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          30종 영양제 × 14개 카테고리 교차 분석 중이에요
        </p>
      </div>
    </div>
  )
}
