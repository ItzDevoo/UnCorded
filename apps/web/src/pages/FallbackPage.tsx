import { useNavigate } from "@solidjs/router";

const FallbackPage = () => {
  const navigate = useNavigate();

  return (
    <div class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 class="font-mono text-xl font-semibold text-foreground">Coming Soon</h1>
      <p class="max-w-sm text-sm text-muted-foreground">
        This feature is under development.
      </p>
      <button
        type="button"
        onClick={() => navigate(-1)}
        class="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        &larr; Back
      </button>
    </div>
  );
};

export default FallbackPage;
