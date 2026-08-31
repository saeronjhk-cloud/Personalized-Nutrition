import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { RETURN_PARAM, readReturnPath } from "../../lib/returnTo";
import {
  OTP_MIN_LENGTH, OTP_MAX_LENGTH, isCompleteOtpCode, normalizeOtpCode,
} from "../../lib/otpCode";
import { readPendingSessionId, runPostLogin } from "../../lib/postLogin";

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
 *
 * ★★★ 2026-08-30 세션50 — **숫자 코드 경로를 추가했다.**
 *   (자릿수는 Supabase 설정이다 — 2026-08-31 실측 8자리. 코드에 못 박지 않는다.)
 *
 *   설치된 안드로이드 앱에서는 위 매직링크 방식이 «구조적으로» 완결될 수 없다.
 *   앱 WebView 의 origin 이 `https://localhost` 라 `emailRedirectTo` 가 허용목록에
 *   걸리지 않고, 걸리게 만들어도 그 주소는 폰 브라우저에서 열 수 없는 주소다.
 *   전체 경위와 실측 근거는 `lib/otpCode.ts` 상단에 있다. 여기서 반복하지 않는다.
 *
 *   ⇒ 코드 경로에는 **리다이렉트가 없다.** origin·허용목록·딥링크가 전혀 관여하지 않는다.
 *
 * ⚠ 매직링크는 «그대로 둔다». 웹에서 잘 되고 있고, 바꿀 이유가 없다.
 *   한 번의 발송으로 링크와 코드가 «둘 다» 간다 — 웹은 누르고, 앱은 입력한다.
 *   ★ 그러려면 Supabase 이메일 템플릿(Magic Link)에 `{{ .Token }}` 이 있어야 한다.
 *     없으면 코드가 메일에 안 실린다. 화면은 코드를 요구하는데 메일엔 없는 상태가 된다.
 */
type Status = "idle" | "sending" | "sent" | "verifying" | "error";

export default function LoginEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const isValidEmail = email.trim().length > 0 && email.includes("@");
  const busy = status === "sending" || status === "verifying";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidEmail) {
      setStatus("error");
      setErrorMessage("올바른 이메일 주소를 입력해 주세요.");
      return;
    }

    setStatus("sending");
    setErrorMessage("");
    setNotice("");

    const lastSessionId = readPendingSessionId();
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
        // 웹 사용자를 위한 링크. 앱에서는 이 값이 허용목록에 안 걸려 Site URL 로
        // 대체되지만, 코드 경로가 있으므로 로그인은 된다.
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();

    const token = normalizeOtpCode(code);
    if (!isCompleteOtpCode(token)) {
      setErrorMessage(`메일에 온 숫자 코드를 모두 입력해 주세요 (${OTP_MIN_LENGTH}자리 이상).`);
      return;
    }

    setStatus("verifying");
    setErrorMessage("");

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });

    if (error || !data?.user) {
      setStatus("sent");                 // 다시 입력할 수 있게 되돌린다
      setErrorMessage(
        error?.message ?? "코드를 확인하지 못했습니다. 다시 시도해 주세요.",
      );
      return;
    }

    // ★ 매직링크 경로(AuthCallback)와 «같은 함수»를 부른다.
    //   여기서 따로 구현하면 두 경로가 조용히 갈라진다.
    const r = await runPostLogin(data.user.id, readPendingSessionId(), "otp_code");
    if (r.linked === "failed") {
      // 규칙60 — 실패를 삼키지 않는다. 로그인은 됐으므로 이동은 계속한다.
      setNotice("로그인은 됐지만 이전 기록 연결에 실패했어요.");
    }

    const returnPath = readReturnPath(window.location.search) ?? "/";
    navigate(returnPath, { replace: true });
  }

  /** 코드 입력 단계에서 «이메일 입력»으로 되돌린다. 재발송은 사용자가 다시 누른다. */
  function handleResend() {
    setCode("");
    setErrorMessage("");
    setStatus("idle");
    setNotice("");
  }

  return (
    <div className="card" style={{ maxWidth: 400, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>로그인</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        {status === "sent" || status === "verifying"
          ? "메일에 온 숫자 코드를 입력하거나, 메일의 링크를 눌러 주세요."
          : "이메일로 로그인 코드와 링크를 보내드립니다."}
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
            disabled={busy || status === "sent"}
            autoComplete="email"
          />
        </div>

        {status !== "sent" && status !== "verifying" && (
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={!isValidEmail || busy}
          >
            {status === "sending" ? "전송 중..." : "로그인 코드 받기"}
          </button>
        )}
      </form>

      {(status === "sent" || status === "verifying") && (
        <form onSubmit={handleVerify} style={{ marginTop: 16 }}>
          <div className="input-group">
            <label htmlFor="login-code">인증 코드</label>
            <input
              id="login-code"
              // ★ number 가 아니라 text + inputMode. number 는 스피너가 붙고
              //   앞자리 0 이 사라지는 브라우저가 있다.
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="input-field"
              // ⚠ 자릿수를 문구로 약속하지 않는다 — Supabase 설정에 따라 6~10 이다.
              placeholder="메일에 온 숫자"
              maxLength={OTP_MAX_LENGTH}
              value={code}
              // 붙여넣기를 전제로 «입력 시점»에 정규화한다 — 공백·하이픈이 섞여도 통과한다.
              onChange={(e) => {
                setCode(normalizeOtpCode(e.target.value));
                if (errorMessage) setErrorMessage("");
              }}
              disabled={status === "verifying"}
              style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={!isCompleteOtpCode(code) || status === "verifying"}
          >
            {status === "verifying" ? "확인 중..." : "로그인"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={status === "verifying"}
            style={{
              width: "100%", marginTop: 10, background: "none", border: "none",
              color: "var(--text-secondary)", fontSize: 13, textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            코드가 안 왔어요 — 다시 보내기
          </button>
        </form>
      )}

      {notice && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 12, textAlign: "center" }}>
          {notice}
        </p>
      )}

      {errorMessage && (
        <p style={{ color: "#dc2626", fontSize: 14, marginTop: 16, textAlign: "center" }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
