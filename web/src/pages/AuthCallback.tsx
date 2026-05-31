import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
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
      sub.subscription.unsubscribe();
      navigate("/", { replace: true });
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
