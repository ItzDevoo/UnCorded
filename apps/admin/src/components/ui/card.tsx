import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn.js";

type DivProps = JSX.HTMLAttributes<HTMLDivElement>;

const Card = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      class={cn("rounded-2xl border border-border bg-card text-card-foreground shadow-sm", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
};

const CardHeader = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div class={cn("flex flex-col gap-1.5 p-6", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

const CardTitle = (props: JSX.HTMLAttributes<HTMLHeadingElement>) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <h3 class={cn("text-lg font-semibold leading-none", local.class)} {...rest}>
      {local.children}
    </h3>
  );
};

const CardContent = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div class={cn("p-6 pt-0", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

export { Card, CardHeader, CardTitle, CardContent };
