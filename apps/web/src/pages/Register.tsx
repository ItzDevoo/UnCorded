import { createSignal, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { USERNAME_MIN, USERNAME_MAX, PASSWORD_MIN } from '@uncorded/shared';
import { signUp } from '../lib/auth.js';
import AuthLayout from '../components/AuthLayout.js';

const Register = () => {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal('');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signUp.email({
        email: email(),
        password: password(),
        name: username(),
        username: username(),
      });
      if (result.error) {
        setError(result.error.message ?? 'Registration failed');
      } else {
        navigate('/app', { replace: true });
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 class="mb-6 text-center text-lg font-bold tracking-tight text-brand">UnCorded</h2>
      <h1 class="mb-2 text-center text-2xl font-bold text-text-primary">Create an account</h1>
      <p class="mb-6 text-center text-sm text-text-secondary">
        You know exactly where your files go.
      </p>

      <Show when={error()}>
        <div class="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error()}</div>
      </Show>

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="mb-1 block text-xs font-medium uppercase text-text-secondary">Email</label>
          <input
            type="email"
            required
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
            class="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium uppercase text-text-secondary">
            Username
          </label>
          <input
            type="text"
            required
            minLength={USERNAME_MIN}
            maxLength={USERNAME_MAX}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            class="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium uppercase text-text-secondary">
            Password
          </label>
          <input
            type="password"
            required
            minLength={PASSWORD_MIN}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            class="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <button
          type="submit"
          disabled={loading()}
          class="w-full rounded-lg bg-brand py-2 font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {loading() ? 'Creating account...' : 'Register'}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <A href="/login" class="text-brand hover:underline">
          Log In
        </A>
      </p>
    </AuthLayout>
  );
};

export default Register;
