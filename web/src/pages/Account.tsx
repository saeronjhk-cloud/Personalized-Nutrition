import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ui/ConfirmDialog'

// 계정 페이지: 로그인 상태 표시 + 로그아웃 + 회원 탈퇴(삭제권).
// 탈퇴는 account-delete Edge Function을 호출(본인 JWT). 처리방침 v4.9 §8 "마이 > 회원 탈퇴"와 정합.
export default function Account() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (alive) { setEmail(user?.email ?? null); setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
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
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>회원 탈퇴</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                탈퇴 시 계정과 개인정보(설문 응답·검진 수치·목표 등)가 영구 삭제되며 되돌릴 수 없습니다.
                동의 이력은 관계 법령에 따라 일정 기간 보관 후 파기됩니다.
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
        description="계정과 모든 개인정보가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="영구 삭제"
        cancelLabel="취소"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
