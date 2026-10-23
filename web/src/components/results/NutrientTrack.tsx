/** 트랙 B «부족하기 쉬운 영양소» (H154) — 위험 신호 문장과 «식약처 인정 기능성» 줄을 분리해서 보여 준다.
 *  판정은 domain/nutrient/track_b.ts 한 곳. 명세 IP/integration/nutrient_track_b_v1 */
import type { TrackBResult } from '../../domain/nutrient/track_b'
import { SUPPLEMENTS, COUPANG_PARTNER_LINKS, COUPANG_KEYWORDS } from '../../engine/data'

const LABEL: Record<string, string> = {
  vitamin_d: '비타민D', folic_acid: '엽산', iron: '철분', calcium: '칼슘', vitamin_b: '비타민B군', vitamin_c: '비타민C',
}

export default function NutrientTrack({ track }: { track: TrackBResult | undefined }) {
  if (!track || (track.products.length === 0 && track.cards.length === 0)) return null
  return (
    <div data-testid="nutrient-track" style={{ marginTop: 'var(--space-5)' }}>
      <div className="results-section-title">
        <span className="results-section-icon">🥛</span>
        섭취를 점검해 볼 영양소
        {track.products.length > 0 && <span className="results-section-count">{track.products.length}종</span>}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-3)', lineHeight: 1.6 }}>
        설문에 답하신 생활 습관을 보고 고른 것으로, 결핍을 진단한 결과가 아니에요.
      </p>
      {track.cards.map((c) => (
        <div key={c.id} data-testid={`nt-card-${c.id}`} className="alert alert-warning" style={{ marginBottom: 'var(--space-3)', lineHeight: 1.6 }}>
          {c.text}
        </div>
      ))}
      {track.products.map((p) => {
        const supp = SUPPLEMENTS.find((s) => s.id === p.id)
        const name = LABEL[p.id] || supp?.name || p.id
        const url = COUPANG_PARTNER_LINKS[p.id] ||
          `https://www.coupang.com/np/search?q=${encodeURIComponent(COUPANG_KEYWORDS[p.id] || name + ' 건강기능식품')}&channel=user&sorter=scoreDesc`
        return (
          <div key={p.id} data-testid={`nt-product-${p.id}`} className="result-card-v2">
            <div className="result-card-header">
              <div className="result-card-name-wrap">
                <span className="result-card-name">{name}</span>
              </div>
            </div>
            <p className="result-card-evidence" style={{ lineHeight: 1.7 }}>{p.text}</p>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              식약처 인정 기능성: {p.mfds}
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="coupang-btn">🛒 쿠팡에서 최저가 보기</a>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-1)', lineHeight: 1.5 }}>
              제휴 링크 · 추천은 설문 결과로만 정해지며, 구매 시 회사가 일정 수수료를 받을 수 있습니다.
            </p>
          </div>
        )
      })}
    </div>
  )
}
