import { useNavigate } from "react-router-dom";
import BiomarkerForm from "../components/checkup/BiomarkerForm";
import { CHECKUP_COMBINE_PAUSED } from "../domain/checkup/interim_pause";

/**
 * 검진 결과 입력 화면. 동의 게이트는 App.tsx 의 CheckupConsentRoute 가 담당(10-13, 4개 검진 라우트 공용).
 * 평가 IP/integration/checkup_subroute_gate_eval_v1.md G15 · 기존 A04~A07 은 래퍼로 이전.
 */
export default function Checkup() {
  const navigate = useNavigate();

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
