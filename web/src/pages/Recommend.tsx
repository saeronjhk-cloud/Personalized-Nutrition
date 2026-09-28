import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CHECKUP_ENABLED } from "../lib/flags";
import { loadUnifiedInputs } from "../lib/loadUnifiedInputs";
import { composeUnifiedInput } from "../domain/unified/compose";
import { runUnifiedRecommendation, type UnifiedResult } from "../domain/unified/recommend";
import RecommendSources from "../components/RecommendSources";
import Results from "./Results";

export default function Recommend() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // D4: 홈 «맞춤 영양제 추천» 카드는 ?entry=home 으로 들어온다.
  //     로그인 + 저장된 설문 있음 → 여기서 바로 통합 추천 / 그 외 → /survey 로 보낸다.
  const fromHome = params.get("entry") === "home";
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error] = useState<string | null>(null);
  const [result, setResult] = useState<UnifiedResult | null>(null);
  const [goalCount, setGoalCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // 입력 로드는 /survey(로그인) 와 공유하는 로더 — 결과 동일성(G14)
      const r = await loadUnifiedInputs();
      if (cancelled) return;
      if (fromHome && (!r.isLoggedIn || !r.hasSurvey)) {
        navigate("/survey", { replace: true });
        return;
      }
      setIsLoggedIn(r.isLoggedIn);
      if (!r.isLoggedIn) {
        setLoading(false);
        return;
      }
      setGoalCount(r.inputs.goals === null ? null : r.inputs.goals.length);
      setResult(runUnifiedRecommendation(composeUnifiedInput({ loaded: r.inputs })));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fromHome, navigate]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) 0" }}>
        <div className="spinner" style={{ margin: "0 auto var(--space-4)" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>맞춤 추천을 준비하는 중...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card" style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 'var(--space-4)' }}>
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
          <div style={{ fontSize: 40, marginBottom: 'var(--space-3)' }}>🌱</div>
          <h2 className="survey-step-title" style={{ textAlign: "center" }}>아직 입력한 정보가 없어요</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
            건강진단이나 설문 중 하나만 입력해도 맞춤 영양제를 추천해 드려요.
          </p>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxWidth: 280, margin: "0 auto" }}>
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

  return (
    <div className="survey-container fade-in">
      <RecommendSources result={result} goalCount={goalCount} />

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
