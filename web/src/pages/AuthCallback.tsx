import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { promoteLocalScans } from "../lib/scanHistory";
import { track } from "../lib/events";
import { readReturnPath } from "../lib/returnTo";
/**
 * ★★ 2026-08-24 세션64c — 로그인 뒤 «원래 하던 일»로 돌아온다.
 *   종전에는 언제나 `/` 로 보냈다. 제보에 로그인 게이트가 붙은 뒤로는,
 *   그러면 사용자가 보던 제품 화면을 잃고 **바코드부터 다시 스캔**해야 한다.
 *   ⚠ 복귀 경로는 «이메일을 거쳐» 오는 값이다. 반드시 `readReturnPath` 로 검증한다
 *     (열린 리다이렉트 방지). 쓸 수 없는 값이면 종전대로 `/` 로 간다.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("로그인 처리 중...");
  useEffect(() => {
    console.log("[AuthCallback] mounted, href:", window.location.href);
    const sessionId = (() => {
      const fromUrl = new URLSearchParams(window.location.search).get("session_id");
      if (fromUrl) return fromUrl;
      try { return localStorage.getItem("last_session_id"); } catch { return null; }
    })();
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
      if (sessionId) {
        const { error } = await supabase
          .from("anon_sessions")
          .update({ linked_user_id: session.user.id })
          .eq("session_id", sessionId)
          .is("linked_user_id", null);
        if (error) {
          console.error("[AuthCallback] link failed:", error.message);
          setMessage("로그인은 됐지만 세션 연결에 실패했어요. 잠시 후 이동합니다.");
        } else {
          console.log("[AuthCallback] linked", sessionId, "to user", session.user.id);
        }
      }
      // 비로그인 스캔 승격(IP/146). 로그인 직후가 자연스러운 시점이다.
      // 실패해도 로그인 흐름을 막지 않는다 — 멱등이므로 Scan 진입 시 재시도된다.
      try {
        const p = await promoteLocalScans();
        if (p.status !== "noop") {
          console.log("[AuthCallback] scan promote:", p);
          track("scan_promote", { status: p.status, attempted: p.attempted, promoted: p.promoted, at: "auth_callback" });
        }
      } catch (e) {
        console.debug("[AuthCallback] promote skipped:", e);
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
