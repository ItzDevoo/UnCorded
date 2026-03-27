import { useNavigate } from "@solidjs/router";

interface FallbackPageProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaTarget?: string;
}

const FallbackPage = (props: FallbackPageProps) => {
  const navigate = useNavigate();

  const title = () => props.title ?? "Coming Soon";
  const description = () => props.description ?? "This feature is under development.";
  const ctaLabel = () => props.ctaLabel ?? "\u2190 Back";

  const handleCta = () => {
    if (props.ctaTarget) {
      navigate(props.ctaTarget);
    } else {
      navigate(-1);
    }
  };

  return (
    <div class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 class="font-mono text-xl font-semibold text-foreground">{title()}</h1>
      <p class="max-w-sm text-sm text-muted-foreground">{description()}</p>
      <button
        type="button"
        onClick={handleCta}
        class="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {ctaLabel()}
      </button>
    </div>
  );
};

export default FallbackPage;
