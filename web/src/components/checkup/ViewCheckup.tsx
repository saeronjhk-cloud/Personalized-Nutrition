import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchMyProfile,
  fetchRanges,
  fetchCheckupRecordDetail,
} from "../../lib/checkup_api";
import {
  runEngine,
  type BiomarkerInput,
  type CategoryResult,
  type Range,
} from "../../domain/checkup/engine";
import RecommendationList from "./RecommendationList";

export default function ViewCheckup() {
  const navigate = useNavigate();
  const { recordId } = useParams<{ recordId: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [needsSex, setNeedsSex] = useState(false);

  const [recordedDate, setRecordedDate] = useState("");
  const [results, setResults] = useState<CategoryResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!recordId) {
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

      const sex = profile.profile?.sex;
      if (sex !== "M" && sex !== "F") {
        setNeedsSex(true);
        setLoading(false);
        return;
      }

      const [detailResult, rangeResult] = await Promise.all([
        fetchCheckupRecordDetail(recordId, profile.userId),
        fetchRanges(sex),
      ]);
      if (cancelled) return;

      if (detailResult.error) {
        setLoadError(detailResult.error);
        setLoading(false);
        return;
      }
      if (rangeResult.error) {
        setLoadError(rangeResult.error);
        setLoading(false);
        return;
      }
      if (!detailResult.detail) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const input: BiomarkerInput = {};
      for (const [key, v] of Object.entries(detailResult.detail.values)) {
        input[key] = v.value;
      }

      setRecordedDate(detailResult.detail.recorded_date);
      setResults(runEngine(input, rangeResult.ranges as Range[]));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const referralCount = useMemo(
    () => results.filter((r) => r.force_medical_referral).length,
    [results],
  );

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

  if (notFound) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card">
          <p style={{ color: "var(--text-secondary)", fontSize: 14, textAlign: "center" }}>
            해당 검진 기록을 찾을 수 없습니다.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ maxWidth: 240, margin: "16px auto 0" }}
            onClick={() => navigate("/checkup/manage")}
          >
            검진 기록 관리로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title" style={{ marginBottom: 4 }}>
          검진 분석 결과
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
          {recordedDate} 검진 기준
        </p>

        {needsSex ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
            프로필에 성별 정보가 없어 분석 결과를 표시할 수 없습니다. 검진 결과 입력 화면에서
            기본 정보를 먼저 저장해 주세요.
          </p>
        ) : loadError ? (
          <p style={{ color: "#dc2626", fontSize: 14 }}>불러오기 오류: {loadError}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {referralCount > 0 && (
              <div
                className="card"
                style={{
                  padding: 16,
                  background: "rgba(220, 38, 38, 0.06)",
                  border: "1px solid rgba(220, 38, 38, 0.25)",
                }}
              >
                <p style={{ margin: 0, fontSize: 14, color: "#b91c1c", lineHeight: 1.6 }}>
                  전문가 상담이 권장되는 항목이 {referralCount}개 있습니다. 자세한 내용은
                  의료 전문가와 상담해 주세요.
                </p>
              </div>
            )}
            <RecommendationList results={results} />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: 16 }}
            onClick={() => navigate("/checkup/manage")}
          >
            목록으로
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1, fontSize: 16 }}
            onClick={() => navigate(`/checkup/edit/${recordId}`)}
          >
            이 기록 수정
          </button>
        </div>
      </div>
    </div>
  );
}
