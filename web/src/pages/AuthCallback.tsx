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

      const lastSessionId = localStorage.getItem("last_session_id");
      if (lastSessionId) {
        await supabase
          .from("anon_sessions")
          .update({ linked_user_id: session.user.id })
          .eq("session_id", lastSessionId);
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
