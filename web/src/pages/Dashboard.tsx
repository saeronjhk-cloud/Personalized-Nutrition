import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMyProfile, fetchCheckupRecords } from "../lib/checkup_api";
import { fetchSurveyResponses } from "../lib/survey_api";
import { CHECKUP_ENABLED, MEAL_ENABLED } from "../lib/flags";
import { loadRecentMealDays } from "../lib/dietSummary";
import { dietCardStatus, DIET_CARD_WINDOW_DAYS } from "../domain/unified/diet_card";

interface ModuleStatus {
  checkupCount: number;
  surveyCount: number;
  /** 최근 7일 식사 기록 일수 — 조회 실패 null (Phase H) */
  dietDays: number | null;
}

function StatusBadge({ text, tone }: { text: string; tone: "done" | "todo" | "soon" }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    done: { bg: "rgba(22,163,74,0.12)", fg: "#16a34a" },
    todo: { bg: "rgba(245,158,11,0.12)", fg: "#b45309" },
    soon: { bg: "rgba(107,114,128,0.12)", fg: "#6b7280" },
  };
  const c = colors[tone];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 600,
        color: c.fg,
        background: c.bg,
        padding: "var(--space-1) var(--space-2)",
        borderRadius: 'var(--radius-pill)',
      }}
    >
      {text}
    </span>
  );
}

interface ModuleCardProps {
  emoji: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}

function ModuleCard({ emoji, title, desc, children }: ModuleCardProps) {
  return (
    <div className="card" style={{ padding: 'var(--space-5)', display: "flex", flexDirection: "column", gap: 'var(--space-2)' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 26 }}>{emoji}</span>
        <strong style={{ fontSize: 17, color: "var(--text)" }}>{title}</strong>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{desc}</p>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 'var(--space-2)' }}>{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [status, setStatus] = useState<ModuleStatus>({ checkupCount: 0, surveyCount: 0, dietDays: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const profile = await fetchMyProfile();
      if (cancelled) return;
      setIsLoggedIn(profile.isLoggedIn);
      if (!profile.isLoggedIn || !profile.userId) {
        setLoading(false);
        return;
      }
      const [checkup, survey, dietDays] = await Promise.all([
        fetchCheckupRecords(profile.userId),
        fetchSurveyResponses(profile.userId),
        MEAL_ENABLED ? loadRecentMealDays(DIET_CARD_WINDOW_DAYS) : Promise.resolve(0),
      ]);
      if (cancelled) return;
      setStatus({
        checkupCount: checkup.records.length,
        surveyCount: survey.responses.length,
        dietDays,
      });
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title">내 건강</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 'var(--space-2)', lineHeight: 1.6 }}>
          원하는 항목만 입력해도 맞춤 영양제와 생활 습관 가이드를 받을 수 있어요.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
          건강진단·설문·식이·운동 중 편한 것부터 시작하세요. 더 많이 입력할수록 추천이 정밀해집니다.
        </p>

        {!isLoggedIn && (
          <div
            className="card"
            style={{
              padding: "var(--space-3) var(--space-4)",
              marginBottom: 'var(--space-5)',
              background: "rgba(142, 202, 230, 0.08)",
              border: "1px solid rgba(142, 202, 230, 0.25)",
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            로그인하면 입력 기록을 저장하고 변화를 추적할 수 있어요.{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              로그인
            </button>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 'var(--space-4)',
          }}
        >
          {/* checkup module gated by compliance flag (flags.ts) */}
          {CHECKUP_ENABLED && (
          <ModuleCard emoji="🩺" title="건강진단" desc="검진 수치를 입력하면 식약처 인정 기능성에 맞춘 추천을 받아요.">
            <div>
              {loading ? (
                <StatusBadge text="확인 중..." tone="soon" />
              ) : isLoggedIn && status.checkupCount > 0 ? (
                <StatusBadge text={`검진 기록 ${status.checkupCount}건`} tone="done" />
              ) : (
                <StatusBadge text="미입력" tone="todo" />
              )}
            </div>
            <button type="button" className="btn btn-primary" style={{ fontSize: 14 }} onClick={() => navigate("/checkup")}>
              검진 수치 입력
            </button>
            {isLoggedIn && status.checkupCount > 0 && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: 14 }} onClick={() => navigate("/checkup/manage")}>
                검진 기록 관리
              </button>
            )}
          </ModuleCard>
          )}

          {/* 증상·생활습관 (설문) — Phase G(D3): 목표는 식사 기록으로 이전 */}
          <ModuleCard
            emoji="📝"
            title={MEAL_ENABLED ? "증상·생활습관" : "증상·목표"}
            desc={MEAL_ENABLED ? "증상과 생활 습관을 설문으로 알려주세요." : "증상과 건강 목표, 생활 습관을 설문으로 알려주세요."}
          >
            <div>
              {loading ? (
                <StatusBadge text="확인 중..." tone="soon" />
              ) : isLoggedIn && status.surveyCount > 0 ? (
                <StatusBadge text={`설문 기록 ${status.surveyCount}건`} tone="done" />
              ) : (
                <StatusBadge text="미입력" tone="todo" />
              )}
            </div>
            <button type="button" className="btn btn-primary" style={{ fontSize: 14 }} onClick={() => navigate("/survey")}>
              설문하기
            </button>
            {isLoggedIn && status.surveyCount > 0 && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: 14 }} onClick={() => navigate("/survey/manage")}>
                설문 기록 관리
              </button>
            )}
            {MEAL_ENABLED && (
              <button type="button" className="text-link" style={{ fontSize: 13, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }} onClick={() => navigate("/meal#goals")}>
                🎯 건강 목표는 식사 기록에서 정해요 →
              </button>
            )}
          </ModuleCard>

          {/* 식이 — Phase H: 식사 기록·주간 리포트 입구 + 추천 반영 상태 (판정 = dietCardStatus, 추천 엔진과 같은 기준) */}
          {MEAL_ENABLED ? (
            <ModuleCard
              emoji="🥗"
              title="식이"
              desc={`식사 사진을 기록하면 최근 ${DIET_CARD_WINDOW_DAYS}일 식사를 맞춤 영양제 추천에 함께 반영해요. 주간 리포트로 식사 흐름도 확인할 수 있어요.`}
            >
              <div>
                {loading ? (
                  <StatusBadge text="확인 중..." tone="soon" />
                ) : (
                  (() => {
                    const st = dietCardStatus({ mealEnabled: MEAL_ENABLED, isLoggedIn, days: status.dietDays });
                    return <StatusBadge text={st.badge} tone={st.tone} />;
                  })()
                )}
              </div>
              <button type="button" className="btn btn-primary" style={{ fontSize: 14 }} onClick={() => navigate("/meal")}>
                식사 기록하기
              </button>
              {isLoggedIn && (
                <button type="button" className="btn btn-secondary" style={{ fontSize: 14 }} onClick={() => navigate("/weekly-report")}>
                  주간 리포트 보기
                </button>
              )}
            </ModuleCard>
          ) : (
            <ModuleCard emoji="🥗" title="식이" desc="식사 패턴을 분석해 부족하기 쉬운 영양을 알려드려요.">
              <div>
                <StatusBadge text="준비 중" tone="soon" />
              </div>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 14 }} disabled>
                곧 제공됩니다
              </button>
            </ModuleCard>
          )}

          {/* 운동 */}
          <ModuleCard emoji="🏃" title="운동" desc="운동 습관에 맞춘 가이드와 관련 기능성을 제안해요.">
            <div>
              <StatusBadge text="준비 중" tone="soon" />
            </div>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 14 }} disabled>
              곧 제공됩니다
            </button>
          </ModuleCard>
        </div>

        <button
          type="button"
          className="btn btn-accent"
          style={{ marginTop: 'var(--space-6)', width: "100%", fontSize: 16 }}
          onClick={() => navigate("/recommend")}
        >
          맞춤 추천 받기
        </button>
        <p style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", marginTop: 'var(--space-2)', lineHeight: 1.6 }}>
          {MEAL_ENABLED ? `${CHECKUP_ENABLED ? "검진·" : ""}설문·식사 기록(최근 7일)·건강 목표를 함께 참조해 맞춤 영양제를 추천합니다.` : "입력한 항목을 바탕으로 맞춤 영양제를 추천합니다. (검진·설문 중 하나만 있어도 가능)"}
        </p>
      </div>
    </div>
  );
}
