import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginEmail() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isValidEmail = email.trim().length > 0 && email.includes("@");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidEmail) {
      setStatus("error");
      setErrorMessage("올바른 이메일 주소를 입력해 주세요.");
      return;
    }

    setStatus("sending");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin + "/auth/callback",
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <div className="card" style={{ maxWidth: 400, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>로그인</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        이메일로 로그인 링크를 보내드립니다.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            type="email"
            className="input-field"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            disabled={status === "sending" || status === "sent"}
            autoComplete="email"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={!isValidEmail || status === "sending" || status === "sent"}
        >
          {status === "sending" ? "전송 중..." : "로그인 링크 받기"}
        </button>
      </form>

      {status === "sent" && (
        <p style={{ color: "var(--primary)", fontSize: 14, marginTop: 16, textAlign: "center" }}>
          이메일을 확인해 주세요
        </p>
      )}

      {status === "error" && errorMessage && (
        <p style={{ color: "#dc2626", fontSize: 14, marginTop: 16, textAlign: "center" }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
