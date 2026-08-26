import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { RETURN_PARAM, readReturnPath } from "../../lib/returnTo";

/**
 * ★★ 2026-08-24 세션64c — 「로그인하고 원래 하던 일로 돌아오기」.
 *
 *   제보에 로그인 게이트가 붙으면서, 로그인 뒤에 사용자를 «원래 보던 제품 화면»으로
 *   돌려보내야 한다. 그런데 이 로그인은 **이메일 매직링크**라 사용자가 앱을 떠났다가
 *   «새 페이지 로드»로 돌아온다 — React 상태·메모리는 전부 사라진다.
 *   ⇒ 복귀 지점을 «URL 로» 넘기는 수밖에 없다: `/login?redirect=/scan?...`
 *     → `emailRedirectTo` 의 쿼리로 실어 보냄 → `AuthCallback` 이 읽어 이동.
 *
 * ⚠ 값 검증은 `lib/returnTo.ts` 가 한다(열린 리다이렉트 방지). 여기서 다시 판단하지 않는다.
 */
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

    const lastSessionId = (() => {
      try { return localStorage.getItem("last_session_id"); } catch { return null; }
    })();
    const redirectUrl = new URL(window.location.origin + "/auth/callback");
    if (lastSessionId) {
      redirectUrl.searchParams.set("session_id", lastSessionId);
    }
    // ★ 복귀 경로를 «그대로» 넘긴다. 검증은 returnTo.ts 가 이미 했고, AuthCallback 이 한 번 더 한다.
    //   (이메일을 거쳐 오는 값이므로 «읽는 쪽»에서도 반드시 다시 검사한다.)
    const returnPath = readReturnPath(window.location.search);
    if (returnPath) {
      redirectUrl.searchParams.set(RETURN_PARAM, returnPath);
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl.toString(),
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
