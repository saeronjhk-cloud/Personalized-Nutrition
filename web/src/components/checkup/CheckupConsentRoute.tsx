import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import CheckupConsentGate from "../CheckupConsentGate";
import { GATE_LOGIN_REQUIRED, GATE_STATUS_ERROR, type GateMode } from "../../domain/checkup/consent_v2";
import { giveCheckupConsent } from "../../lib/checkupConsent";
import { resolveCheckupGateMode } from "../../lib/checkupGate";

export type CheckupGateViewMode = GateMode | "loading";

interface ViewProps {
  mode: CheckupGateViewMode;
  onLogin: () => void;
  onRetry: () => void;
  /** 서버 기록. 실패 시 throw → 게이트가 오류 표시(A04). */
  onAccept: (consent: { core: boolean; age14: boolean; combine: boolean }) => Promise<void>;
  onDecline: () => void;
  children: ReactNode;
}

/**
 * 검진 화면 공용 게이트 — 화면만(효과 없음, 정적 렌더 테스트 G08~G13).
 * pass 일 때만 children 을 렌더한다 → 하위 화면은 동의 전에 마운트되지 않음(기록 조회 0, K4).
 */
export function CheckupGateView({ mode, onLogin, onRetry, onAccept, onDecline, children }: ViewProps) {
  if (mode === "pass") return <>{children}</>;
  if (mode === "loading") {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card" data-testid="checkup-gate-loading">불러오는 중…</div>
      </div>
    );
  }
  if (mode === "login" || mode === "error") {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card">
          <p data-testid={`checkup-gate-${mode}`} style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7, marginBottom: "var(--space-4)" }}>
            {mode === "login" ? GATE_LOGIN_REQUIRED : GATE_STATUS_ERROR}
          </p>
          <button type="button" className="btn btn-primary" onClick={mode === "login" ? onLogin : onRetry}>
            {mode === "login" ? "로그인" : "다시 시도"}
          </button>
        </div>
      </div>
    );
  }
  return <CheckupConsentGate mode={mode} onAccept={onAccept} onDecline={onDecline} />;
}

/**
 * 검진 4개 라우트(/checkup · /checkup/manage · /checkup/view/:id · /checkup/edit/:id) 공용 동의 게이트.
 * 서버(SQL 161)가 권위 · 브라우저 저장소 사용 안 함. 동의 후 같은 주소에 머묾(K3), 거부 → 홈.
 * 평가 IP/integration/checkup_subroute_gate_eval_v1.md
 */
export default function CheckupConsentRoute({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CheckupGateViewMode>("loading");

  async function refresh() {
    setMode(await resolveCheckupGateMode());
  }
  useEffect(() => { refresh(); }, []);

  return (
    <CheckupGateView
      mode={mode}
      onLogin={() => navigate("/login")}
      onRetry={() => { setMode("loading"); refresh(); }}
      onAccept={async ({ core, age14, combine }) => {
        await giveCheckupConsent(core, age14, combine);   // 실패 시 throw → 게이트가 오류 표시(A04)
        await refresh();
      }}
      onDecline={() => navigate("/")}
    >
      {children}
    </CheckupGateView>
  );
}
