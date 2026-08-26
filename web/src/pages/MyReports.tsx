import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listMyContributions, MeokseonAuthError, meokseonConfigured } from '../lib/meokseon'
import { loginPathWithReturn } from '../lib/returnTo'
import {
  CONTRIBUTIONS_TITLE, CONTRIBUTIONS_EMPTY, CONTRIBUTIONS_EMPTY_HINT,
  CONTRIBUTIONS_STATUS_HINT, CONTRIBUTIONS_LOAD_ERROR, CONTRIBUTIONS_ACCOUNT_NOTICE,
  CONTRIBUTION_NO_BARCODE_NOTE,
  describeContributionStatus, describeContributionNutrition, describeContributionTitle,
  contributionBarcode, formatReportedAt,
  type MyContribution,
} from '../domain/meokseon/contributions'
import {
  CONTRIBUTIONS_LOGIN_REQUIRED, CONTRIBUTIONS_LOGIN_CTA,
} from '../domain/meokseon/reportAuth'

/**
 * 「내가 보낸 제보」 — 이력 화면.
 *
 * ★★ 왜 생겼나 (2026-08-24, 세션64c · 제이 지시)
 *   「제보에 대한 결과를 당장이든 검증 후든 소비자에게 제공해야 해.」
 *   제보를 보내고 나면 그걸로 끝이었다. 서버 `contributions` 에는 기록이 남는데
 *   **그 기록을 사용자에게 돌려주는 화면이 없었다.**
 *
 * ★ 계약 — `GET /api/contributions/mine?limit=20&offset=0` (**인증 필수**)
 *   식별자는 «계정»이다(`Authorization: Bearer <supabase access token>`).
 *   세션64b 의 `device_id` 파라미터는 **없어졌다** — 서버 인증이 Supabase 로 전면 교체됐다.
 *
 * ★★★ 이 파일이 지키는 것 — 딱 셋이다.
 *   ① **판정·문구를 여기서 만들지 않는다.** 전부 `domain/meokseon/contributions.ts` 와
 *      `domain/meokseon/reportAuth.ts` 의 순수 함수·상수다. 두 곳에 두면 갈라진다.
 *   ② **「없다」와 「못 불러왔다」와 「로그인이 필요하다」를 «섞지 않는다».**
 *      조회에 실패했는데 「아직 보낸 제보가 없어요」를 띄우면 그건 거짓말이고,
 *      사용자는 자기 제보가 사라졌다고 읽는다.
 *   ③ **없는 상태를 지어내지 않는다.** 서버 `status` 는 사람이 검토하기 전까지 `pending` 이다
 *      (근거: `crowdsourceService.js:564` INSERT · `adminRoutes.js` 만 값을 바꾼다).
 *      처음 보는 값은 「상태 확인 중」으로 둔다 — 「검토 중」처럼 진행되는 듯이 말하지 않는다.
 *
 * ⚠ 2026-08-24 기준 서버에 이 엔드포인트는 **아직 없다**(구현 중).
 *   실제 왕복은 확인하지 못했다. 테스트는 목(mock) 기반이다.
 */

type Phase = 'loading' | 'ready' | 'need_login' | 'error'

const CARD: React.CSSProperties = { marginBottom: 16 }
const MUTED: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.6 }

export default function MyReports() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [items, setItems] = useState<MyContribution[]>([])
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const page = await listMyContributions({ limit: 20, offset: 0 })
      setItems(page.items)
      setTotal(page.total)
      setPhase('ready')
    } catch (e) {
      // ★ 401 을 「불러오지 못했어요」로 뭉개지 않는다 — 할 일이 「로그인」으로 다르다.
      if (e instanceof MeokseonAuthError) { setPhase('need_login'); return }
      // ⚠ 빈 배열로 «조용히» 넘어가지 않는다. 그러면 화면이 「제보가 없어요」라고 거짓말한다.
      console.error('[MyReports] load failed:', e)
      setPhase('error')
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (!meokseonConfigured()) {
    return (
      <div className="survey-container fade-in"><div className="survey-card">
        <h2 className="survey-step-title">{CONTRIBUTIONS_TITLE}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          제품 조회 서비스 설정이 필요합니다. (VITE_MEOKSEON_API_URL 미설정)
        </p>
      </div></div>
    )
  }

  return (
    <div className="survey-container fade-in">
      <div className="survey-card" style={CARD}>
        <h2 className="survey-step-title">{CONTRIBUTIONS_TITLE}</h2>

        {phase === 'loading' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>불러오는 중…</p>
        )}

        {/* ★ 로그인 필요 — 「없다」와 «절대» 섞지 않는다. */}
        {phase === 'need_login' && (
          <div data-testid="reports-need-login">
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
              {CONTRIBUTIONS_LOGIN_REQUIRED}
            </p>
            <button
              type="button" className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }}
              onClick={() => navigate(loginPathWithReturn('/scan/reports'))}
            >{CONTRIBUTIONS_LOGIN_CTA}</button>
          </div>
        )}

        {/* ★ 조회 실패 — 다시 시도할 길을 준다. 「없다」고 말하지 않는다. */}
        {phase === 'error' && (
          <div data-testid="reports-load-error">
            <p style={{ color: 'var(--danger)', fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
              {CONTRIBUTIONS_LOAD_ERROR}
            </p>
            <button
              type="button" className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}
              onClick={load}
            >다시 시도</button>
          </div>
        )}

        {phase === 'ready' && items.length === 0 && (
          <div data-testid="reports-empty">
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 6 }}>
              {CONTRIBUTIONS_EMPTY}
            </p>
            <p style={{ ...MUTED, marginBottom: 14 }}>{CONTRIBUTIONS_EMPTY_HINT}</p>
            <button
              type="button" className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }}
              onClick={() => navigate('/scan')}
            >제품 스캔하러 가기</button>
          </div>
        )}

        {phase === 'ready' && items.length > 0 && (
          <div data-testid="reports-list">
            <p style={{ ...MUTED, marginBottom: 4 }}>총 {total}건</p>
            {/* 상태가 왜 잘 안 바뀌는지 «먼저» 말한다. 오지 않을 변화를 기다리게 하지 않는다. */}
            <p style={{ ...MUTED, marginBottom: 12 }}>{CONTRIBUTIONS_STATUS_HINT}</p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0 }}>
              {items.map((it) => {
                const status = describeContributionStatus(it.status)
                const nutrition = describeContributionNutrition(it.nutritionStatus)
                const barcode = contributionBarcode(it)
                const at = formatReportedAt(it.createdAt)
                const row = (
                  <>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>
                      {describeContributionTitle(it)}
                    </div>
                    <div style={{ ...MUTED, marginTop: 3 }}>
                      {at ? `${at} · ` : ''}{status.label}
                      {nutrition ? ` · ${nutrition}` : ''}
                    </div>
                  </>
                )
                return (
                  <li key={it.id} style={{ border: '1px solid var(--border-light)', borderRadius: 8 }}>
                    {barcode ? (
                      // 바코드가 있으면 그 제품 화면으로. 앱의 제품 조회는 «바코드»가 키다.
                      <button
                        type="button"
                        onClick={() => navigate(`/scan?barcode=${encodeURIComponent(barcode)}`)}
                        style={{
                          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                          textAlign: 'left', padding: '10px 12px',
                        }}
                      >{row}</button>
                    ) : (
                      // ⚠ 갈 곳이 없으면 «왜» 없는지 말한다. 눌러도 아무 일 없는 버튼을 두지 않는다.
                      <div style={{ padding: '10px 12px' }}>
                        {row}
                        <div style={{ ...MUTED, marginTop: 4 }}>{CONTRIBUTION_NO_BARCODE_NOTE}</div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            <p style={{ ...MUTED, marginTop: 14 }}>{CONTRIBUTIONS_ACCOUNT_NOTICE}</p>
          </div>
        )}
      </div>
    </div>
  )
}
