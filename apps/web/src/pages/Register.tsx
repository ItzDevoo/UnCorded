import { createSignal, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { USERNAME_MIN, USERNAME_MAX, PASSWORD_MIN } from "@uncorded/shared";
import { signUp } from "../lib/auth.js";
import AuthLayout from "../components/AuthLayout.js";
import { Input } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";

const Register = () => {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError("");
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
        navigate("/app", { replace: true });
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 class="mb-6 text-center text-lg font-bold tracking-tight text-primary">UnCorded</h2>
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

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="mb-1 block text-xs font-medium uppercase text-secondary-foreground">
            Email
          </label>
          <Input
            type="email"
            required
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium uppercase text-secondary-foreground">
            Username
          </label>
          <Input
            type="text"
            required
            minLength={USERNAME_MIN}
            maxLength={USERNAME_MAX}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium uppercase text-secondary-foreground">
            Password
          </label>
          <Input
            type="password"
            required
            minLength={PASSWORD_MIN}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </div>
        <Button type="submit" disabled={loading()} size="lg" class="w-full">
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
