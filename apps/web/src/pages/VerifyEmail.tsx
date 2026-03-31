import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { sendVerificationEmail, useSession } from "../lib/auth.js";
import AuthLayout from "../components/AuthLayout.js";
import { Button } from "../components/ui/button.js";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const session = useSession();
  const [resending, setResending] = createSignal(false);
  const [resent, setResent] = createSignal(false);
  const [error, setError] = createSignal("");

  const email = () => session()?.data?.user?.email ?? "";

  const handleResend = async () => {
    const addr = email();
    if (!addr) return;
    setResending(true);
    setResent(false);
    setError("");
    try {
      await sendVerificationEmail({ email: addr, callbackURL: "/home" });
      setResent(true);
    } catch {
      setError("Failed to send verification email. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <div class="flex flex-col items-center text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="mb-4 h-12 w-12 text-primary"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
          />
        </svg>

        <h1 class="mb-2 text-2xl font-bold text-foreground">Check your email</h1>

        <p class="mb-6 text-sm text-secondary-foreground">
          We sent a verification link to{" "}
          <span class="font-medium text-foreground">{email() || "your email"}</span>.
          Click it to verify your account.
        </p>

        <Button
          variant="outline"
          class="w-full"
          disabled={resending()}
          onClick={handleResend}
        >
          {resending() ? "Sending..." : resent() ? "Sent!" : error() ? "Retry" : "Resend Email"}
        </Button>

        <Show when={error()}>
          <p class="mt-3 text-sm text-destructive">{error()}</p>
        </Show>

        <p class="mt-4 text-xs text-muted-foreground">
          Didn't receive it? Check your spam folder.
        </p>

        <button
          type="button"
          class="mt-3 text-xs text-muted-foreground underline transition-colors hover:text-foreground"
          onClick={() => navigate("/home", { replace: true })}
        >
          Skip for now
        </button>
        <p class="mt-1 text-[11px] text-muted-foreground">
          You can verify later in Settings. Some features may be limited.
        </p>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;
