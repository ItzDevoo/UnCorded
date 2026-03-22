import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { USERNAME_MIN, USERNAME_MAX, USERNAME_REGEX, DISPLAY_NAME_MAX } from "@uncorded/shared";
import { authClient } from "../lib/auth.js";
import { api, ApiRequestError } from "../lib/api.js";
import AuthLayout from "../components/AuthLayout.js";
import AuthGuard from "../components/AuthGuard.js";
import { Input } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";

const Onboarding = () => {
  const navigate = useNavigate();

  const [username, setUsername] = createSignal("");
  const [displayName, setDisplayName] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (loading()) return;
    setError("");

    const trimmed = username().trim();
    if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
      setError(`Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters`);
      return;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = { username: trimmed };
      const dn = displayName().trim();
      if (dn) body.displayName = dn;

      await api("/api/users/@me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      // Refresh session so AuthGuard sees the username (best-effort)
      try {
        await authClient.getSession({ fetchOptions: { throw: false } });
      } catch {
        // Session will refresh on next navigation anyway
      }
      navigate("/home", { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.body.message ?? "Something went wrong" : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <AuthLayout>
        <h1 class="mb-2 text-center text-2xl font-bold text-foreground">
          Welcome to UnCorded!
        </h1>
        <p class="mb-6 text-center text-sm text-secondary-foreground">
          Let's set up your profile.
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
              for="onboarding-username"
              class="mb-1 block text-sm font-medium text-muted-foreground"
            >
              Username <span class="text-destructive">*</span>
            </label>
            <Input
              id="onboarding-username"
              type="text"
              required
              minLength={USERNAME_MIN}
              maxLength={USERNAME_MAX}
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              placeholder="your_username"
            />
          </div>
          <div>
            <label
              for="onboarding-displayname"
              class="mb-1 block text-sm font-medium text-muted-foreground"
            >
              Display Name <span class="text-xs text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="onboarding-displayname"
              type="text"
              maxLength={DISPLAY_NAME_MAX}
              value={displayName()}
              onInput={(e) => setDisplayName(e.currentTarget.value)}
              placeholder="How others see you"
            />
          </div>
          <Button type="submit" disabled={loading()} size="lg" class="w-full">
            {loading() ? "Setting up..." : "Continue"}
          </Button>
        </form>
      </AuthLayout>
    </AuthGuard>
  );
};

export default Onboarding;
