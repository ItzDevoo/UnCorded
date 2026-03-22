import { createSignal, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { signIn } from "../lib/auth.js";
import AuthLayout from "../components/AuthLayout.js";
import { Input } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn.email({
        email: email(),
        password: password(),
      });
      if (result.error) {
        setError(result.error.message ?? "Sign in failed");
      } else {
        navigate("/home", { replace: true });
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 class="mb-2 text-center text-2xl font-bold text-foreground">Welcome back</h1>
      <p class="mb-6 text-center text-sm text-secondary-foreground">
        Sign in to continue to UnCorded
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
          <label for="login-email" class="mb-1 block text-sm font-medium text-muted-foreground">
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            required
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </div>
        <div>
          <label for="login-password" class="mb-1 block text-sm font-medium text-muted-foreground">
            Password
          </label>
          <Input
            id="login-password"
            type="password"
            required
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
          <div class="mt-1 text-right">
            <A href="/forgot-password" class="text-xs text-primary hover:underline">
              Forgot your password?
            </A>
          </div>
        </div>
        <Button type="submit" disabled={loading()} size="lg" class="w-full">
          {loading() ? "Signing in..." : "Log In"}
        </Button>
      </form>

      <p class="mt-6 text-center text-sm text-secondary-foreground">
        Need an account?{" "}
        <A href="/register" class="text-primary hover:underline">
          Register
        </A>
      </p>
    </AuthLayout>
  );
};

export default Login;
