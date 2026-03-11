import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn.js";

type DivProps = JSX.HTMLAttributes<HTMLDivElement>;

const Card = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      data-slot="card"
      class={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
};

const CardHeader = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div data-slot="card-header" class={cn("flex flex-col gap-1.5 p-6", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

const CardTitle = (props: JSX.HTMLAttributes<HTMLHeadingElement>) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <h3
      data-slot="card-title"
      class={cn("text-lg font-semibold leading-none", local.class)}
      {...rest}
    >
      {local.children}
    </h3>
  );
};

const CardDescription = (props: JSX.HTMLAttributes<HTMLParagraphElement>) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <p
      data-slot="card-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </p>
  );
};

const CardContent = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div data-slot="card-content" class={cn("p-6 pt-0", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

const CardFooter = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div data-slot="card-footer" class={cn("flex items-center p-6 pt-0", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
