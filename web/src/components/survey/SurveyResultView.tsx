import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchMyProfile } from "../../lib/checkup_api";
import { fetchSurveyResponseDetail } from "../../lib/survey_api";
import { runRecommendation } from "../../engine";
import Results from "../../pages/Results";
import type { RecommendationResult, SurveyAnswers } from "../../types";

export default function SurveyResultView() {
  const navigate = useNavigate();
  const { responseId } = useParams<{ responseId: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [createdAt, setCreatedAt] = useState("");
  const [answers, setAnswers] = useState<SurveyAnswers | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!responseId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);

      const profile = await fetchMyProfile();
      if (cancelled) return;
      setIsLoggedIn(profile.isLoggedIn);
      if (!profile.isLoggedIn || !profile.userId) {
        setLoading(false);
        return;
      }

      const { detail, error } = await fetchSurveyResponseDetail(responseId, profile.userId);
      if (cancelled) return;
      if (error) {
        setLoadError(error);
        setLoading(false);
        return;
      }
      if (!detail) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setCreatedAt(detail.created_at);
      setAnswers(detail.answers);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [responseId]);

  const result: RecommendationResult | null = useMemo(() => {
    if (!answers) return null;
    try {
      return runRecommendation(answers);
    } catch (e) {
      console.error("[SurveyResultView] runRecommendation failed:", e);
      return null;
    }
  }, [answers]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>분석 결과를 불러오는 중...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card">
          <p style={{ color: "var(--text-secondary)", fontSize: 14, textAlign: "center" }}>
            로그인이 필요합니다.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ maxWidth: 240, margin: "16px auto 0" }}
            onClick={() => navigate("/login")}
          >
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  if (notFound || loadError || !result) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card">
          <p style={{ color: "var(--text-secondary)", fontSize: 14, textAlign: "center" }}>
            {loadError ? `불러오기 오류: ${loadError}` : "해당 설문 기록을 찾을 수 없습니다."}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ maxWidth: 240, margin: "16px auto 0" }}
            onClick={() => navigate("/survey/manage")}
          >
            설문 기록 관리로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="survey-container fade-in">
      <div
        className="card"
        style={{
          padding: "12px 16px",
          marginBottom: 16,
          background: "rgba(142, 202, 230, 0.08)",
          border: "1px solid rgba(142, 202, 230, 0.25)",
          fontSize: 14,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        📅 <strong>{(createdAt || "").slice(0, 10)}</strong>에 진행한 설문의 분석 결과입니다.
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}> (리포트 상단의 날짜는 조회 시점 기준)</span>
      </div>

      <Results
        result={result}
        answers={null}
        error={null}
        persistHistory={false}
        onRestart={() => navigate("/survey/manage")}
        restartLabel="📋 설문 기록 목록으로"
      />
    </div>
  );
}
