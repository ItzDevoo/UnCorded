import { createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authClient } from "../lib/auth.js";
import AuthLayout from "../components/AuthLayout.js";
import { Input } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";

const ForgotPassword = () => {
  const [email, setEmail] = createSignal("");
  const [submitted, setSubmitted] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authClient.requestPasswordReset({
        email: email(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Silently ignore — never reveal whether the email exists
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <AuthLayout>
      <h1 class="mb-2 text-center text-2xl font-bold text-foreground">Forgot your password?</h1>
      <p class="mb-6 text-center text-sm text-secondary-foreground">
        Enter your email and we'll send you a reset link.
      </p>

      <Show
        when={!submitted()}
        fallback={
          <div class="animate-fade-in space-y-4 text-center">
            <p class="text-sm text-foreground">
              If an account exists with that email, we've sent a reset link.
            </p>
            <p class="text-sm text-secondary-foreground">Check your inbox and spam folder.</p>
            <A href="/login" class="mt-4 inline-block text-sm text-primary hover:underline">
              Back to login
            </A>
          </div>
        }
      >
        <form onSubmit={handleSubmit} class="animate-fade-in space-y-4">
          <div>
            <label
              for="forgot-email"
              class="mb-1 block text-sm font-medium text-muted-foreground"
            >
              Email
            </label>
            <Input
              id="forgot-email"
              type="email"
              required
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </div>
          <Button type="submit" disabled={loading()} size="lg" class="w-full">
            {loading() ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      </Show>

      <p class="mt-6 text-center text-sm text-secondary-foreground">
        Remember your password?{" "}
        <A href="/login" class="text-primary hover:underline">
          Log in
        </A>
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;
