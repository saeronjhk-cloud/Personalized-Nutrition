import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message] = useState("로그인 처리 중...");

  useEffect(() => {
    async function handleCallback() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate("/login", { replace: true });
        return;
      }

      const sessionId = (() => {
        const fromUrl = new URLSearchParams(window.location.search).get("session_id");
        if (fromUrl) return fromUrl;
        try { return localStorage.getItem("last_session_id"); } catch { return null; }
      })();

      if (sessionId) {
        const { error } = await supabase
          .from("anon_sessions")
          .update({ linked_user_id: session.user.id })
          .eq("session_id", sessionId);

        if (error) console.error("[AuthCallback] link failed:", error);
        else console.log("[AuthCallback] linked session", sessionId, "to user", session.user.id);
      }

      navigate("/", { replace: true });
    }

    handleCallback();
  }, [navigate]);

  return (
    <div className="loading-container fade-in">
      <div className="spinner" />
      <p style={{ fontWeight: 600, fontSize: 18, textAlign: "center" }}>{message}</p>
    </div>
  );
}
