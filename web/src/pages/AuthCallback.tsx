import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { readReturnPath } from "../lib/returnTo";
import { readPendingSessionId, runPostLogin } from "../lib/postLogin";
/**
 * ★★ 2026-08-24 세션64c — 로그인 뒤 «원래 하던 일»로 돌아온다.
 *   종전에는 언제나 `/` 로 보냈다. 제보에 로그인 게이트가 붙은 뒤로는,
 *   그러면 사용자가 보던 제품 화면을 잃고 **바코드부터 다시 스캔**해야 한다.
 *   ⚠ 복귀 경로는 «이메일을 거쳐» 오는 값이다. 반드시 `readReturnPath` 로 검증한다
 *     (열린 리다이렉트 방지). 쓸 수 없는 값이면 종전대로 `/` 로 간다.
 *
 * ★★ 2026-08-30 세션50 — 로그인 직후 작업을 `lib/postLogin.ts` 로 옮겼다.
 *   ⛔ **설치된 안드로이드 앱은 이 화면에 «한 번도» 도달한 적이 없다.**
 *      (앱 origin 이 `https://localhost` 라 리다이렉트가 Site URL 로 대체됐다 —
 *       경위는 `lib/otpCode.ts` 상단에 전부 적어 두었다.)
 *      그래서 앱 사용자에게는 세션 연결·스캔 승격이 조용히 안 돌고 있었다.
 *   ⇒ 그 작업들을 이 «경로»가 아니라 «함수»에 두고, 6자리 코드 로그인도 같은 함수를
 *     부르게 했다. 이 파일은 이제 «웹의 매직링크 착지점»일 뿐이다.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("로그인 처리 중...");
  useEffect(() => {
    console.log("[AuthCallback] mounted, href:", window.location.href);
    const sessionId = readPendingSessionId(window.location.search);
    console.log("[AuthCallback] session_id to link:", sessionId);
    // 검증을 통과한 «내부 경로»만 쓴다. 아니면 홈(종전 동작).
    const returnPath = readReturnPath(window.location.search) ?? "/";
    console.log("[AuthCallback] returnPath:", returnPath);
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[AuthCallback] event:", event, "user:", session?.user?.id);
      if (done) return;
      if (event !== "SIGNED_IN" || !session?.user) return;
      done = true;

      const r = await runPostLogin(session.user.id, sessionId, "auth_callback");
      if (r.linked === "failed") {
        // 규칙60 — 조용히 넘어가지 않는다. 로그인은 됐으므로 흐름은 계속한다.
        setMessage("로그인은 됐지만 세션 연결에 실패했어요. 잠시 후 이동합니다.");
      }

      sub.subscription.unsubscribe();
      navigate(returnPath, { replace: true });
    });
    const timeout = setTimeout(() => {
      if (done) return;
      console.warn("[AuthCallback] timeout — no SIGNED_IN event in 5s");
      sub.subscription.unsubscribe();
      navigate("/login", { replace: true });
    }, 5000);
    return () => {
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);
  return (
    <div className="loading-container fade-in">
      <div className="spinner" />
      <p style={{ fontWeight: 600, fontSize: 18, textAlign: "center" }}>{message}</p>
    </div>
  );
}
