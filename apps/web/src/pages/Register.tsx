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
          <label for="register-username" class="mb-1 block text-sm font-medium text-muted-foreground">
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
          <label for="register-password" class="mb-1 block text-sm font-medium text-muted-foreground">
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
