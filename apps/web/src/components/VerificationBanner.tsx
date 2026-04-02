import { createSignal, Show } from "solid-js";
import { sendVerificationEmail, useSession } from "../lib/auth.js";
import { showToast } from "./ui/toast.js";

const DISMISSED_KEY = "verification-banner-dismissed";

const VerificationBanner = () => {
  const session = useSession();
  const [dismissed, setDismissed] = createSignal(sessionStorage.getItem(DISMISSED_KEY) === "1");
  const [resending, setResending] = createSignal(false);
  const [resent, setResent] = createSignal(false);

  const user = () => session()?.data?.user;
  const shouldShow = () => {
    const u = user();
    if (!u || dismissed()) return false;
    return u.emailVerified === false;
  };

  const handleResend = async (e: MouseEvent) => {
    e.preventDefault();
    const email = user()?.email;
    if (!email) return;
    setResending(true);
    setResent(false);
    try {
      await sendVerificationEmail({ email, callbackURL: "/home" });
      setResent(true);
    } catch {
      showToast("Failed to resend verification email. Please try again.", "error");
    } finally {
      setResending(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <Show when={shouldShow()}>
      <div class="flex items-center justify-between gap-2 bg-warning/15 px-4 py-2 text-sm text-warning">
        <span>
          Your email isn't verified. Check your inbox or{" "}
          <button
            type="button"
            class="font-medium underline hover:no-underline"
            disabled={resending()}
            onClick={handleResend}
          >
            {resending() ? "sending..." : resent() ? "sent!" : "resend"}
          </button>
          .
        </span>
        <button
          type="button"
          class="shrink-0 text-warning/60 hover:text-warning"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-4 w-4"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </Show>
  );
};

export default VerificationBanner;
