import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchMyProfile,
  fetchCheckupRecords,
  fetchCheckupRecordDetail,
  fetchRanges,
} from "../lib/checkup_api";
import { fetchSurveyResponses, fetchSurveyResponseDetail } from "../lib/survey_api";
import { CHECKUP_ENABLED, MEAL_ENABLED } from "../lib/flags";
import { loadRecentDietSummary } from "../lib/dietSummary";
import type { DietDailyAvg } from "../domain/unified/diet_adapter";
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

      // 식이→추천 배선: MEAL_ENABLED일 때만 최근 7일 meal_log를 DietDailyAvg로 로드해 병합.
      let dietSummary: DietDailyAvg | null = null;
      if (MEAL_ENABLED) {
        dietSummary = await loadRecentDietSummary(7);
        if (cancelled) return;
      }

      const unified = runUnifiedRecommendation({
        surveyAnswers,
        checkupResults,
        dietSummary,
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
            {CHECKUP_ENABLED && (
              <button type="button" className="btn btn-primary" onClick={() => navigate("/checkup")}>검진 수치 입력</button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => navigate("/survey")}>설문하기</button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/dashboard")}>내 건강으로</button>
          </div>
        </div>
      </div>
    );
  }

  // 반영된 입력 소스(식이 포함). 식이는 실제 기여했을 때만(저확신 제외) 근거로 표기.
  const contributors: string[] = [];
  if (result.sources.checkup) contributors.push("검진");
  if (result.sources.survey) contributors.push("설문");
  if (result.sources.diet && !result.dietLowConfidence) contributors.push("식이");
  const srcText =
    contributors.length >= 2
      ? `${contributors.join(" + ")} 결과를 합쳐 추천했어요.`
      : contributors.length === 1
        ? `${contributors[0]} 결과를 바탕으로 추천했어요.`
        : "입력하신 정보를 바탕으로 추천했어요.";

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

      {MEAL_ENABLED && result.sources.diet && result.dietLowConfidence && (
        <div
          className="card"
          style={{
            padding: "10px 14px",
            marginBottom: 16,
            background: "rgba(255, 183, 3, 0.08)",
            border: "1px solid rgba(255, 183, 3, 0.25)",
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          🍽️ 식사 기록이 아직 부족해(2일 미만) 이번 추천엔 반영하지 못했어요. 며칠만 더 기록하면 식이까지 반영해 더 정밀해집니다.
        </div>
      )}

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
