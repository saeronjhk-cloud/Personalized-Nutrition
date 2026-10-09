import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BiomarkerForm from "../components/checkup/BiomarkerForm";
import CheckupConsentGate from "../components/CheckupConsentGate";
import { CHECKUP_COMBINE_PAUSED } from "../domain/checkup/interim_pause";
import { decideGateMode, GATE_LOGIN_REQUIRED, GATE_STATUS_ERROR, type GateMode } from "../domain/checkup/consent_v2";
import { hasConsentedCheckup } from "../lib/analytics";
import { fetchCheckupConsentStatus, giveCheckupConsent } from "../lib/checkupConsent";
import { supabase } from "../lib/supabase";

export default function Checkup() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<GateMode | "loading">("loading");

  // 검진 동의 v2 게이트(SQL 161 서버 기록이 권위). 평가 IP/integration/checkup_consent_v2_eval_v1.md A05~A07
  async function refresh() {
    const { data: { user } } = await supabase.auth.getUser();
    const status = user ? await fetchCheckupConsentStatus() : null;
    setMode(decideGateMode({ loggedIn: !!user, status, legacyLocalConsent: hasConsentedCheckup() }));
  }
  useEffect(() => { refresh(); }, []);

  if (mode === "loading") {
    return <div className="survey-container fade-in"><div className="survey-card">불러오는 중…</div></div>;
  }
  if (mode === "login" || mode === "error") {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card">
          <p data-testid={`checkup-gate-${mode}`} style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7, marginBottom: "var(--space-4)" }}>
            {mode === "login" ? GATE_LOGIN_REQUIRED : GATE_STATUS_ERROR}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => (mode === "login" ? navigate("/login") : refresh())}>
            {mode === "login" ? "로그인" : "다시 시도"}
          </button>
        </div>
      </div>
    );
  }
  if (mode === "first" || mode === "reconsent") {
    return (
      <CheckupConsentGate
        mode={mode}
        onAccept={async ({ core, age14, combine }) => {
          await giveCheckupConsent(core, age14, combine);   // 실패 시 throw → 게이트가 오류 표시(A04)
          await refresh();
        }}
        onDecline={() => navigate("/")}
      />
    );
  }

  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <h2 className="survey-step-title" style={{ marginBottom: 0 }}>
            건강검진 결과 분석
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "var(--space-2) 14px", fontSize: 14, flexShrink: 0, width: "auto" }}
            onClick={() => navigate("/checkup/manage")}
          >
            검진 기록 관리
          </button>
        </div>
        {!CHECKUP_COMBINE_PAUSED && (
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
            검진 수치를 입력하면 설문 결과와 함께 더 정밀한 영양제 추천을 받을 수 있습니다.
          </p>
        )}
        <BiomarkerForm />
      </div>
    </div>
  );
}
