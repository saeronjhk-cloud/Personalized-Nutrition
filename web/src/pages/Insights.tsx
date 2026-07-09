import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'

// get_insights() RPC 데이터 계약 (작업지시서 58 §3). 개인 단위 없음 · k-익명성(셀<5 억제).
interface CohortRow { age_group: string; gender: string; n: number }
interface SymptomRow extends CohortRow { symptom: string }
interface ConditionRow extends CohortRow { condition: string }
interface GoalRow extends CohortRow { goal: string }
interface LifestyleRow extends CohortRow { dim: string; val: string }
interface PersonaRow extends CohortRow { persona_id: string }
interface Insights {
  generated_at: string
  k_min: number
  cohort: CohortRow[]
  symptom: SymptomRow[]
  condition: ConditionRow[]
  goal: GoalRow[]
  lifestyle: LifestyleRow[]
  persona: PersonaRow[]
}

const BRAND = '#2D5A27'

function genderLabel(g: string): string {
  if (g === 'male') return '남'
  if (g === 'female') return '여'
  return g || '미상'
}

// n 합산 집계 후 상위 N개 (코호트 교차를 합쳐 전체 분포로)
function topBy<T extends { n: number }>(rows: T[], key: (r: T) => string, top = 12): { name: string; n: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (!k) continue
    m.set(k, (m.get(k) ?? 0) + (r.n || 0))
  }
  return Array.from(m.entries())
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, top)
}

function HBarCard({ title, data }: { title: string; data: { name: string; n: number }[] }) {
  const height = Math.max(120, data.length * 34 + 24)
  return (
    <div className="survey-card" style={{ marginBottom: 20 }}>
      <h3 className="survey-step-title" style={{ fontSize: 16, marginBottom: 12 }}>{title}</h3>
      {data.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>표시할 집계가 없습니다(5명 미만 셀은 제외).</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: any) => [`${v}명`, '인원']} />
            <Bar dataKey="n" fill={BRAND} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default function Insights() {
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (alive) { setError('로그인이 필요합니다. 어드민 계정으로 로그인해 주세요.'); setLoading(false) }
          return
        }
        const { data: rpc, error: rpcErr } = await supabase.rpc('get_insights')
        if (!alive) return
        if (rpcErr) {
          const msg = (rpcErr.message || '').toLowerCase()
          setError(msg.includes('forbidden') || (rpcErr as any).code === '42501'
            ? '이 페이지는 어드민 전용입니다. 접근 권한이 없습니다.'
            : '집계를 불러오지 못했습니다: ' + rpcErr.message)
        } else {
          setData(rpc as unknown as Insights)
        }
      } catch (e: any) {
        if (alive) setError(e?.message || '알 수 없는 오류')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  if (loading) {
    return <div className="survey-container fade-in"><div className="survey-card">집계를 불러오는 중…</div></div>
  }
  if (error) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card">
          <h2 className="survey-step-title">익명 집계 대시보드</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error}</p>
        </div>
      </div>
    )
  }
  if (!data) return null

  const cohort = (data.cohort || [])
    .map(r => ({ name: `${r.age_group}·${genderLabel(r.gender)}`, n: r.n }))
    .sort((a, b) => b.n - a.n)
  const symptom = topBy(data.symptom || [], r => r.symptom)
  const condition = topBy(data.condition || [], r => r.condition)
  const goal = topBy(data.goal || [], r => r.goal)
  const persona = topBy(data.persona || [], r => r.persona_id)

  // 생활습관: dim별 val 분포 합산 표
  const lifestyleMap = new Map<string, Map<string, number>>()
  for (const r of (data.lifestyle || [])) {
    if (!r.dim || !r.val) continue
    if (!lifestyleMap.has(r.dim)) lifestyleMap.set(r.dim, new Map())
    const vm = lifestyleMap.get(r.dim)!
    vm.set(r.val, (vm.get(r.val) ?? 0) + (r.n || 0))
  }
  const dimLabel: Record<string, string> = {
    diet_pattern: '식사패턴', alcohol: '음주', smoking: '흡연', exercise: '운동',
  }

  const genAt = new Date(data.generated_at).toLocaleString('ko-KR')

  return (
    <div className="survey-container fade-in">
      <div className="survey-card" style={{ marginBottom: 20 }}>
        <h2 className="survey-step-title">익명 집계 대시보드</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
          개인 식별 정보 없이 코호트(연령대·성별) 단위로 집계한 통계입니다. 인원 {data.k_min}명 미만 셀은
          재식별 방지(k-익명성)를 위해 표시되지 않습니다. 생성: {genAt}
        </p>
      </div>

      <HBarCard title="코호트 규모 (연령대·성별)" data={cohort} />
      <HBarCard title="증상 상위" data={symptom} />
      <HBarCard title="기저질환 상위" data={condition} />
      <HBarCard title="건강 목표 상위" data={goal} />
      <HBarCard title="추천 페르소나 분포" data={persona} />

      <div className="survey-card">
        <h3 className="survey-step-title" style={{ fontSize: 16, marginBottom: 12 }}>생활습관 분포</h3>
        {Array.from(lifestyleMap.entries()).length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>표시할 집계가 없습니다.</p>
        ) : (
          Array.from(lifestyleMap.entries()).map(([dim, vm]) => (
            <div key={dim} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{dimLabel[dim] || dim}</div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {Array.from(vm.entries()).sort((a, b) => b[1] - a[1]).map(([val, n]) => (
                    <tr key={val} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '6px 0', color: 'var(--text-secondary)' }}>{val}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{n}명</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
