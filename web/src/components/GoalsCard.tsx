import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { loadEffectiveGoals, saveUserGoals, fetchLatestBody } from "../lib/userGoals";
import { hasConsentedCollection, hasConsentedSensitive, markConsentAcknowledged } from "../lib/analytics";
import {
  GOAL_OPTIONS,
  UNDERWEIGHT_BMI,
  bmiFromAnswers,
  isGoalBlockedByBmi,
  validateGoalsForSave,
} from "../domain/goals/goals";
import ConsentGate from "./ConsentGate";
import { GOAL_COACHING_ENABLED } from "../lib/flags";

/**
 * 식사 기록 «내 건강 목표» 카드 (웹앱트랙 Phase G · D1 13종 전부)
 * - 저장소 user_goals. 맞춤 영양제 추천(설문·/recommend)이 이 값을 참조한다.
 * - 건강 목표 = 민감정보 → 설문과 같은 민감정보 동의가 있어야 저장(동의 범위에 «건강 목표» 명시).
 * - 섭식 안전장치(IP/155 §2 참고선): BMI<18.5 면 «체중관리» 비활성.
 * - D5: 목표 기반 식사 코칭 문구는 넣지 않는다(서박사 확정 영역).
 */
export default function GoalsCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [bmi, setBmi] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [needConsent, setNeedConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) return;
      setUserId(user.id);
      const [g, body] = await Promise.all([loadEffectiveGoals(user.id), fetchLatestBody(user.id)]);
      if (!alive) return;
      setGoals(g.goals);
      setBmi(bmiFromAnswers(body));
    })();
    return () => { alive = false; };
  }, []);

  if (!userId || goals === null) return null;

  const consented = hasConsentedCollection() && hasConsentedSensitive();

  function startEdit() {
    setMsg(null);
    if (!consented) { setNeedConsent(true); return; }
    setDraft(goals ?? []);
    setEditing(true);
  }

  async function save() {
    if (!userId) return;
    const v = validateGoalsForSave(draft, bmi);
    setSaving(true);
    const r = await saveUserGoals(userId, v.goals);
    setSaving(false);
    if (!r.ok) { setMsg("목표를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."); return; }
    setGoals(v.goals);
    setEditing(false);
    setMsg("저장했어요. 다음 맞춤 영양제 추천부터 반영돼요.");
  }

  if (needConsent) {
    return (
      <ConsentGate
        acceptLabel="동의하고 목표 설정"
        onAccept={() => { markConsentAcknowledged(); setNeedConsent(false); setDraft(goals ?? []); setEditing(true); }}
        onDecline={() => setNeedConsent(false)}
      />
    );
  }

  const labelOf = (id: string) => GOAL_OPTIONS.find((g) => g.id === id);
  const underweight = bmi != null && bmi < UNDERWEIGHT_BMI;

  return (
    <div id="goals" className="survey-card" style={{ marginBottom: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>🎯 내 건강 목표</div>
        {!editing && (
          <button type="button" className="btn btn-secondary" style={{ width: "auto", padding: "var(--space-1) var(--space-3)", fontSize: 13 }} onClick={startEdit}>
            {goals.length ? "편집" : "목표 정하기"}
          </button>
        )}
      </div>

      {!editing && (
        <div style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          {goals.length === 0
            ? "아직 정한 목표가 없어요. 목표를 정하면 맞춤 영양제 추천이 목표에 맞춰져요."
            : goals.map((g) => { const o = labelOf(g); return o ? `${o.emoji} ${o.label}` : g; }).join(" · ")}
        </div>
      )}

      {editing && (
        <>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "var(--space-2) 0", lineHeight: 1.6 }}>
            여러 개 고를 수 있어요. 고른 목표는 맞춤 영양제 추천에 쓰여요.{' '}
            {GOAL_COACHING_ENABLED
              ? '근육 증가·체중 관리 목표는 식사 기록에 맞춘 단백질 조언도 드려요. 다른 목표의 식사 조언은 준비 중이에요.'
              : '목표에 맞춘 식사 조언은 준비 중이에요.'}
          </p>
          <div className="grid-2">
            {GOAL_OPTIONS.map((g) => {
              const blocked = isGoalBlockedByBmi(g.id, bmi);
              const on = draft.includes(g.id);
              return (
                <div
                  key={g.id}
                  className={`check-card ${on ? "selected" : ""}`}
                  aria-disabled={blocked}
                  style={blocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                  onClick={() => {
                    if (blocked) return;
                    setDraft((d) => (d.includes(g.id) ? d.filter((x) => x !== g.id) : [...d, g.id]));
                  }}
                >
                  <div className="check-icon">✓</div>
                  <span className="check-text">{g.emoji} {g.label}</span>
                </div>
              );
            })}
          </div>
          {underweight && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: "var(--space-2)", lineHeight: 1.6 }}>
              최근 설문 기준 체질량지수(BMI)가 {UNDERWEIGHT_BMI} 미만이라 «체중 / 체지방 관리» 목표는 선택할 수 없어요.
              체중 관련 고민은 의료 전문가와 상담해 주세요.
            </p>
          )}
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
            <button type="button" className="btn btn-primary" disabled={saving} style={{ flex: 1 }} onClick={save}>
              {saving ? "저장 중…" : `저장${draft.length ? ` (${draft.length}개)` : ""}`}
            </button>
            <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </>
      )}
      {msg && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>{msg}</div>}
    </div>
  );
}
