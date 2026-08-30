import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { MEAL_ENABLED } from '../lib/flags'
import { hasServerMealConsent, revokeMealConsentServer, revokeMealConsent } from '../lib/mealConsent'

// 계정 페이지: 로그인 상태 표시 + 로그아웃 + 회원 탈퇴(삭제권).
// 탈퇴는 account-delete Edge Function을 호출(본인 JWT). 처리방침 v4.9 §8 "마이 > 회원 탈퇴"와 정합.
export default function Account() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mealConsented, setMealConsented] = useState(false)
  const [mealMsg, setMealMsg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!alive) return
      setEmail(user?.email ?? null)
      if (user && MEAL_ENABLED) {
        try { setMealConsented(await hasServerMealConsent()) } catch { /* noop */ }
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  async function handleRevokeMeal() {
    try {
      await revokeMealConsentServer()
      revokeMealConsent()
      setMealConsented(false)
      setMealMsg('식사 사진 분석 동의를 철회했어요. 이후 국외이전 분석이 중단되고, 저장된 식사 사진과 분석 결과가 지체 없이 삭제됩니다. (계정과 다른 기능은 계속 이용할 수 있어요.)')
    } catch {
      setMealMsg('철회 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    // ★ 2026-08-28: 식사 사진 동의는 «계정»에 붙는데 로컬 캐시는 «브라우저»에 남는다.
    //   로그아웃하면서 안 지우면, 다음 계정으로 로그인했을 때
    //     로컬 = 동의함  /  서버(새 계정) = 기록 없음
    //   이 되어 게이트가 안 뜨고 Edge 는 계속 거부한다. 사용자는 갇힌다 —
    //   Account 의 철회 버튼도 서버 기준이라 비활성이어서 탈출구가 없다.
    //   실제 사고(2026-08-28): 계정을 바꾼 뒤 사진 분석이 전면 차단됐다.
    //   ⚠ 이건 «철회»가 아니라 «로컬 캐시 정리»다. 서버의 동의 기록은 건드리지 않는다.
    revokeMealConsent()
    navigate('/')
  }

  async function handleDelete() {
    setBusy(true); setError(null)
    try {
      const { error: fnErr } = await supabase.functions.invoke('account-delete', { method: 'POST' })
      if (fnErr) {
        setError('탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.')
        setBusy(false)
        return
      }
      await supabase.auth.signOut()
      setBusy(false); setConfirmOpen(false)
      navigate('/', { replace: true })
    } catch (e: any) {
      setError(e?.message || '알 수 없는 오류')
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="survey-container fade-in"><div className="survey-card">불러오는 중…</div></div>
  }

  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title">계정</h2>
        {email ? (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              로그인 계정: <strong>{email}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              <button type="button" className="btn btn-secondary" onClick={handleLogout}>로그아웃</button>
            </div>

            {MEAL_ENABLED && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>식사 사진 분석 동의</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                  식사 사진 분석을 위한 건강 민감정보 처리 및 국외이전(OpenAI, 미국) 동의를 철회할 수 있습니다.
                  철회 시 이후 식사 사진 분석이 중단되며, 계정과 다른 기능은 계속 이용할 수 있습니다.
                </p>
                {mealMsg && <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>{mealMsg}</p>}
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!mealConsented}
                  onClick={handleRevokeMeal}
                >
                  {mealConsented ? '식사 사진 분석 동의 철회' : '동의 내역 없음'}
                </button>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>회원 탈퇴</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                탈퇴 시 계정과 개인정보(설문 응답·검진 수치·목표 등)가 영구 삭제되며 되돌릴 수 없습니다.
                다만 동의 사실 증명을 위한 최소 감사기록(건강정보·사진 제외)은 회사의 정당한 이익에 따라 3년간 분리 보관 후 파기됩니다.
              </p>
              {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={() => setConfirmOpen(true)}
              >
                회원 탈퇴
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>로그인이 필요합니다.</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>로그인</button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        danger
        busy={busy}
        title="정말 탈퇴하시겠어요?"
        description="계정과 개인정보가 영구 삭제됩니다. 다만 동의 사실 증명을 위한 최소 감사기록(건강정보·사진 제외)은 3년간 분리 보관됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="영구 삭제"
        cancelLabel="취소"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
