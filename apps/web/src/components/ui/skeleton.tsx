import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn.js";

type SkeletonProps = JSX.HTMLAttributes<HTMLDivElement>;

const Skeleton = (props: SkeletonProps) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="skeleton"
      class={cn(
        "animate-skeleton rounded-md [--skeleton-highlight:oklch(1_0_0/4%)] [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--color-muted)_0_0/200%_100%_fixed]",
        local.class,
      )}
      {...rest}
    />
  );
};

export { Skeleton };
export type { SkeletonProps };
