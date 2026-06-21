import { useNavigate } from "react-router-dom";
import SurveyRecordManager from "../components/survey/SurveyRecordManager";

export default function SurveyManage() {
  const navigate = useNavigate();
  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title">내 설문 기록</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          과거에 진행한 설문의 분석 결과를 다시 보거나 삭제할 수 있습니다.
        </p>
        <SurveyRecordManager />
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginTop: 24, width: "100%", fontSize: 16 }}
          onClick={() => navigate("/survey")}
        >
          새 설문하러 가기
        </button>
      </div>
    </div>
  );
}
