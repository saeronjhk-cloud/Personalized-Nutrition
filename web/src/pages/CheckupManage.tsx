import { useNavigate } from "react-router-dom";
import CheckupRecordManager from "../components/checkup/CheckupRecordManager";

export default function CheckupManage() {
  const navigate = useNavigate();
  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title">검진 기록 관리</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          과거에 입력한 검진 기록을 수정하거나 삭제할 수 있습니다.
        </p>
        <CheckupRecordManager />
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginTop: 24, width: "100%", fontSize: 16 }}
          onClick={() => navigate("/checkup")}
        >
          검진 결과 입력으로 돌아가기
        </button>
      </div>
    </div>
  );
}
