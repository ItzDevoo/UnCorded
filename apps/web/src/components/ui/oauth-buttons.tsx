import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/cn.js";

type OAuthButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  class?: string;
};

const baseClass =
  "relative flex w-full items-center justify-center gap-3 rounded-lg border px-4 h-10 text-sm font-medium transition-all duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0";

export function GoogleIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function DiscordIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      class="h-4 w-4 text-white"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}

// Google brand guidelines require white bg with dark text — raw colors intentional
export function GoogleButton(props: OAuthButtonProps) {
  const [local, rest] = splitProps(props, ["onClick", "disabled", "label", "class"]);
  return (
    <button
      type="button"
      class={cn(baseClass, "border-border bg-white text-gray-700 hover:bg-gray-50", local.class)}
      onClick={local.onClick}
      disabled={local.disabled}
      {...rest}
    >
      <GoogleIcon />
      {local.label ?? "Continue with Google"}
    </button>
  );
}

export function DiscordButton(props: OAuthButtonProps) {
  const [local, rest] = splitProps(props, ["onClick", "disabled", "label", "class"]);
  return (
    <button
      type="button"
      class={cn(
        baseClass,
        "border-[#5865F2] bg-[#5865F2] text-white hover:bg-[#4752C4]",
        local.class,
      )}
      onClick={local.onClick}
      disabled={local.disabled}
      {...rest}
    >
      <DiscordIcon />
      {local.label ?? "Continue with Discord"}
    </button>
  );
}

export function OAuthDivider() {
  return (
    <div class="flex items-center gap-3">
      <div class="h-px flex-1 bg-border" />
      <span class="text-xs text-muted-foreground">or</span>
      <div class="h-px flex-1 bg-border" />
    </div>
  );
}
