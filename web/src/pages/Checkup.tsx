import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BiomarkerForm from "../components/checkup/BiomarkerForm";
import CheckupConsentGate from "../components/CheckupConsentGate";
import { hasConsentedCheckup, markCheckupConsent } from "../lib/analytics";

export default function Checkup() {
  const navigate = useNavigate();
  const [consented, setConsented] = useState(hasConsentedCheckup());

  // 검진 민감정보 수집·이용 opt-in 동의(#3) 게이트. 미동의 시 입력 화면 진입 차단.
  if (!consented) {
    return (
      <CheckupConsentGate
        onAccept={() => { markCheckupConsent(); setConsented(true); }}
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
            gap: 12,
            marginBottom: 8,
          }}
        >
          <h2 className="survey-step-title" style={{ marginBottom: 0 }}>
            건강검진 결과 분석
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "8px 14px", fontSize: 14, flexShrink: 0, width: "auto" }}
            onClick={() => navigate("/checkup/manage")}
          >
            검진 기록 관리
          </button>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          검진 수치를 입력하면 설문 결과와 함께 더 정밀한 영양제 추천을 받을 수 있습니다.
        </p>
        <BiomarkerForm />
      </div>
    </div>
  );
}
