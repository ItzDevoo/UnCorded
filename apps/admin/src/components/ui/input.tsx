import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn.js";

type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

const Input = (props: InputProps) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <input
      class={cn(
        "h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground shadow-xs transition-shadow duration-200 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring disabled:opacity-50 outline-none",
        local.class,
      )}
      {...rest}
    />
  );
};

export { Input };
