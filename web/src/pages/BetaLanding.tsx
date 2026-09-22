/**
 * /beta — 사진 수집 베타 패널 입구 (세션54 · 2026-09-22)
 *
 * 제이가 패널에게 보내는 링크가 이 페이지다. 여기서 «무엇을 부탁하는지»를 명시하고
 * 참여 플래그(localStorage)를 켠 뒤 식사 페이지로 보낸다. 별도 빌드·앱 설치 없음.
 *
 * ⚠ 이건 «제품 베타»가 아니라 «사진 수집 패널»이다 — 문구가 그 기대치를 잡는다(IP/181 §9).
 */
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import PageMeta from '../components/PageMeta'
import { isBetaPanel, joinBetaPanel, leaveBetaPanel } from '../lib/betaPanel'

const ASKS = [
  { icon: '🍚', text: '밥 종류가 보이게 — 쌀밥·잡곡밥·현미밥·보리밥·돌솥밥 등' },
  { icon: '🍲', text: '국·탕 한 그릇 — 설렁탕·곰탕·갈비탕·육개장·삼계탕·해장국 등' },
  { icon: '📷', text: '위에서, 그릇 전체가 나오게, 밝은 곳에서' },
  { icon: '🔁', text: '하루 1~3장, 2주. 같은 사진은 두 번 올려도 한 번으로 셉니다' },
]

export default function BetaLanding() {
  const navigate = useNavigate()
  const [joined, setJoined] = useState(isBetaPanel())

  function join() {
    joinBetaPanel()
    setJoined(true)
    // 로그인 여부는 /meal 이 스스로 판단한다. 로그인이 필요하면 거기서 /login 으로 보내고,
    // 매직링크로 돌아올 때 /meal 로 복귀하도록 returnTo 를 싣는다.
    navigate('/meal')
  }

  return (
    <div className="survey-container fade-in">
      <PageMeta title="사진 수집 패널 참여" description="서박사의 영양공식 — 한식 식사 사진 수집 베타 패널" />
      <div className="survey-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <span style={{ background: 'var(--primary)', color: 'var(--bg-card)', borderRadius: 'var(--radius-pill)', padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-sm)', fontWeight: 'var(--weight-semibold)' }}>BETA</span>
          <h2 className="survey-step-title" style={{ margin: 0 }}>사진 수집 패널</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-body)', lineHeight: 1.7, marginBottom: 'var(--space-3)' }}>
          안녕하세요, 서박사의 영양공식입니다. 이 앱은 아직 만드는 중이고, 지금은 <strong>한식 사진을 얼마나
          잘 알아보는지</strong>를 재고 있습니다. 앱을 평가해 달라는 부탁이 아닙니다 —
          <strong> 식사 사진을 찍어 주시면 됩니다.</strong> 결과가 틀리면 그게 오히려 저희에게 필요한 데이터입니다.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-3)' }}>
          {ASKS.map((a) => (
            <li key={a.text} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', fontSize: 'var(--font-body)', lineHeight: 1.6, marginBottom: 'var(--space-2)' }}>
              <span aria-hidden>{a.icon}</span><span>{a.text}</span>
            </li>
          ))}
        </ul>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', lineHeight: 1.6, marginBottom: 'var(--space-3)' }}>
          사진은 영양 분석을 위해 국외(OpenAI, 미국)로 전송되며, 첫 촬영 전에 동의 화면이 한 번 나옵니다.
          분석 결과가 틀렸거나 앱이 이상하면 결과 화면의 <strong>「의견 보내기」</strong> 버튼으로 알려 주세요.
          하루 30장까지 분석됩니다.
        </p>
        <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={join}>
          {joined ? '식사 사진 찍으러 가기' : '참여하고 시작하기'}
        </button>
        {joined && (
          <button type="button" className="text-link" style={{ display: 'block', margin: 'var(--space-3) auto 0', background: 'none', border: 0, fontSize: 'var(--font-sm)' }}
            onClick={() => { leaveBetaPanel(); setJoined(false) }}>
            패널 참여 해제
          </button>
        )}
      </div>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-caption)' }}>
        로그인은 이메일로 받은 링크 또는 8자리 코드로 합니다. 이 폰의 브라우저에서 진행해 주세요.
      </p>
    </div>
  )
}
