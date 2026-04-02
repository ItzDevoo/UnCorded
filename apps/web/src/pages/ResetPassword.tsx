import { createSignal, Show } from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { PASSWORD_MIN } from "@uncorded/shared";
import { authClient } from "../lib/auth.js";
import AuthLayout from "../components/AuthLayout.js";
import { Input } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError("");

    if (password().length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }

    if (password() !== confirmPassword()) {
      setError("Passwords do not match.");
      return;
    }

    const token = Array.isArray(searchParams.token) ? searchParams.token[0] : searchParams.token;
    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password(),
        token,
      });
      if (result.error) {
        setError(result.error.message ?? "Failed to reset password. The link may have expired.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 class="mb-2 text-center text-2xl font-bold text-foreground">Reset your password</h1>

      <Show when={searchParams.error === "INVALID_TOKEN"}>
        <div
          role="alert"
          class="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          This reset link is invalid or has expired.{" "}
          <A href="/forgot-password" class="underline">
            Request a new one
          </A>
          .
        </div>
      </Show>

      <Show
        when={!success()}
        fallback={
          <div class="animate-fade-in space-y-4 text-center">
            <p class="text-sm text-foreground">Your password has been reset successfully.</p>
            <A href="/login" class="mt-4 inline-block text-sm text-primary hover:underline">
              Log in with your new password
            </A>
          </div>
        }
      >
        <p class="mb-6 text-center text-sm text-secondary-foreground">
          Choose a new password for your account.
        </p>

        <Show when={error()}>
          <div
            role="alert"
            class="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error()}
          </div>
        </Show>

        <form onSubmit={handleSubmit} class="animate-fade-in space-y-4">
          <div>
            <label
              for="reset-password"
              class="mb-1 block text-sm font-medium text-muted-foreground"
            >
              New Password
            </label>
            <Input
              id="reset-password"
              type="password"
              required
              minLength={PASSWORD_MIN}
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </div>
          <div>
            <label for="reset-confirm" class="mb-1 block text-sm font-medium text-muted-foreground">
              Confirm Password
            </label>
            <Input
              id="reset-confirm"
              type="password"
              required
              minLength={PASSWORD_MIN}
              value={confirmPassword()}
              onInput={(e) => setConfirmPassword(e.currentTarget.value)}
            />
          </div>
          <Button type="submit" disabled={loading()} size="lg" class="w-full">
            {loading() ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </Show>
    </AuthLayout>
  );
};

export default ResetPassword;
