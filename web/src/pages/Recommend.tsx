import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchMyProfile,
  fetchCheckupRecords,
  fetchCheckupRecordDetail,
  fetchRanges,
} from "../lib/checkup_api";
import { fetchSurveyResponses, fetchSurveyResponseDetail } from "../lib/survey_api";
import { runEngine, type Range, type CategoryResult, type BiomarkerInput } from "../domain/checkup/engine";
import { runUnifiedRecommendation, type UnifiedResult } from "../domain/unified/recommend";
import type { SurveyAnswers } from "../types";
import Results from "./Results";

export default function Recommend() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UnifiedResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);

      const profile = await fetchMyProfile();
      if (cancelled) return;
      setIsLoggedIn(profile.isLoggedIn);
      if (!profile.isLoggedIn || !profile.userId) {
        setLoading(false);
        return;
      }

      const sex = profile.profile?.sex === "F" ? "F" : "M";
      const age = profile.profile?.birth_year
        ? new Date().getFullYear() - profile.profile.birth_year
        : null;

      // 최신 검진 → CategoryResult[]
      let checkupResults: CategoryResult[] | null = null;
      const recs = await fetchCheckupRecords(profile.userId);
      if (cancelled) return;
      if (recs.records.length > 0) {
        const [detail, rangeRes] = await Promise.all([
          fetchCheckupRecordDetail(recs.records[0].id, profile.userId),
          fetchRanges(sex),
        ]);
        if (cancelled) return;
        if (detail.detail && !rangeRes.error) {
          const input: BiomarkerInput = {};
          for (const [key, v] of Object.entries(detail.detail.values)) {
            input[key] = v.value;
          }
          checkupResults = runEngine(input, rangeRes.ranges as Range[]);
        }
      }

      // 최신 설문 → answers
      let surveyAnswers: SurveyAnswers | null = null;
      const surveys = await fetchSurveyResponses(profile.userId);
      if (cancelled) return;
      if (surveys.responses.length > 0) {
        const sDetail = await fetchSurveyResponseDetail(surveys.responses[0].id, profile.userId);
        if (cancelled) return;
        if (sDetail.detail) surveyAnswers = sDetail.detail.answers;
      }

      const unified = runUnifiedRecommendation({
        surveyAnswers,
        checkupResults,
        profile: { sex, age },
      });
      setResult(unified);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>맞춤 추천을 준비하는 중...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card" style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
            맞춤 추천을 받으려면 로그인이 필요합니다.
          </p>
          <button type="button" className="btn btn-primary" style={{ maxWidth: 240, margin: "0 auto" }} onClick={() => navigate("/login")}>
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  // 신호 없음 (입력 데이터 없음)
  if (!result || !result.hasSignal) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
          <h2 className="survey-step-title" style={{ textAlign: "center" }}>아직 입력한 정보가 없어요</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
            건강진단이나 설문 중 하나만 입력해도 맞춤 영양제를 추천해 드려요.
          </p>
          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280, margin: "0 auto" }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/checkup")}>검진 수치 입력</button>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/survey")}>설문하기</button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/dashboard")}>내 건강으로</button>
          </div>
        </div>
      </div>
    );
  }

  const srcText = result.sources.checkup && result.sources.survey
    ? "검진 + 설문 결과를 합쳐 추천했어요."
    : result.sources.checkup
      ? "검진 결과를 바탕으로 추천했어요. 설문을 더하면 더 정밀해져요."
      : "설문 결과를 바탕으로 추천했어요. 검진 수치를 더하면 더 정밀해져요.";

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
        ✅ {srcText}
      </div>

      <Results
        result={result}
        answers={null}
        error={null}
        persistHistory={false}
        onRestart={() => navigate("/dashboard")}
        restartLabel="🏠 내 건강으로"
      />
    </div>
  );
}
