import { cva, type VariantProps } from "class-variance-authority";
import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn.js";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary shadow-xs hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/90",
        ghost: "border-transparent hover:bg-accent hover:text-accent-foreground",
        outline:
          "border border-border bg-transparent shadow-xs hover:bg-accent/50 hover:text-accent-foreground",
        destructive:
          "bg-destructive text-white border border-destructive shadow-xs hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4",
        lg: "h-10 px-6",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = (props: ButtonProps) => {
  const [local, rest] = splitProps(props, ["class", "variant", "size", "children"]);
  return (
    <button
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    >
      {local.children}
    </button>
  );
};

export { Button, buttonVariants };
