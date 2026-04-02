import { createSignal, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { USERNAME_MIN, USERNAME_MAX, PASSWORD_MIN } from "@uncorded/shared";
import { signIn, signUp } from "../lib/auth.js";
import AuthLayout from "../components/AuthLayout.js";
import { Input } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";
import { GoogleButton, DiscordButton, OAuthDivider } from "../components/ui/oauth-buttons.js";

function calculateAge(dob: string): number {
  // Parse as local date to avoid UTC timezone shift (e.g., "2013-03-16" in UTC-5 becoming Mar 15)
  const [y, m, d] = dob.split("-").map(Number) as [number, number, number];
  const birth = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

const Register = () => {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [dob, setDob] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [tosAgreed, setTosAgreed] = createSignal(false);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [oauthLoading, setOauthLoading] = createSignal(false);

  const handleOAuth = async (provider: "google" | "discord") => {
    setError("");
    setOauthLoading(true);
    try {
      await signIn.social({ provider, callbackURL: `${window.location.origin}/home` });
    } catch {
      setError("Something went wrong");
      setOauthLoading(false);
    }
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError("");

    if (!tosAgreed()) {
      setError("You must agree to the Terms of Service");
      return;
    }

    if (!dob()) {
      setError("Date of birth is required");
      return;
    }

    if (calculateAge(dob()) < 13) {
      setError("You must be at least 13 years old to use UnCorded");
      return;
    }

    setLoading(true);
    try {
      const result = await signUp.email({
        email: email(),
        password: password(),
        name: username(),
        username: username(),
      });
      if (result.error) {
        setError(result.error.message ?? "Registration failed");
      } else {
        navigate("/verify-email", { replace: true });
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 class="mb-2 text-center text-2xl font-bold text-foreground">Create an account</h1>
      <p class="mb-6 text-center text-sm text-secondary-foreground">
        You know exactly where your files go.
      </p>

      <Show when={error()}>
        <div
          role="alert"
          class="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error()}
        </div>
      </Show>

      <div class="animate-fade-in space-y-3">
        <GoogleButton
          onClick={() => handleOAuth("google")}
          disabled={oauthLoading() || loading()}
        />
        <DiscordButton
          onClick={() => handleOAuth("discord")}
          disabled={oauthLoading() || loading()}
        />
      </div>

      <OAuthDivider />

      <form onSubmit={handleSubmit} class="animate-fade-in space-y-4">
        <div>
          <label for="register-email" class="mb-1 block text-sm font-medium text-muted-foreground">
            Email
          </label>
          <Input
            id="register-email"
            type="email"
            required
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </div>
        <div>
          <label
            for="register-username"
            class="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Username
          </label>
          <Input
            id="register-username"
            type="text"
            required
            minLength={USERNAME_MIN}
            maxLength={USERNAME_MAX}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
        </div>
        <div>
          <label for="register-dob" class="mb-1 block text-sm font-medium text-muted-foreground">
            Date of Birth
          </label>
          <Input
            id="register-dob"
            type="date"
            required
            max={todayStr}
            value={dob()}
            onInput={(e) => setDob(e.currentTarget.value)}
          />
        </div>
        <div>
          <label
            for="register-password"
            class="mb-1 block text-sm font-medium text-muted-foreground"
          >
            Password
          </label>
          <Input
            id="register-password"
            type="password"
            required
            minLength={PASSWORD_MIN}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
          <p class="mt-1 text-xs text-muted-foreground">
            Must be at least {PASSWORD_MIN} characters
          </p>
        </div>
        <label class="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={tosAgreed()}
            onChange={(e) => setTosAgreed(e.currentTarget.checked)}
            class="mt-0.5 rounded border-border"
          />
          <span>
            I agree to the{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >
              Privacy Policy
            </a>
          </span>
        </label>
        <Button type="submit" disabled={loading() || !tosAgreed()} size="lg" class="w-full">
          {loading() ? "Creating account..." : "Register"}
        </Button>
      </form>

      <p class="mt-6 text-center text-sm text-secondary-foreground">
        Already have an account?{" "}
        <A href="/login" class="text-primary hover:underline">
          Log In
        </A>
      </p>
    </AuthLayout>
  );
};

export default Register;
