import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn.js";

type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

const Input = (props: InputProps) => {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <input
      data-slot="input"
      class={cn(
        "h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-xs transition-shadow duration-150 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring disabled:opacity-50 outline-none aria-[invalid=true]:border-destructive/50",
        local.class,
      )}
      {...rest}
    />
  );
};

export { Input };
export type { InputProps };
