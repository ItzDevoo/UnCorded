import { splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn.js";

type ScrollAreaProps = JSX.HTMLAttributes<HTMLDivElement>;

const ScrollArea = (props: ScrollAreaProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      data-slot="scroll-area"
      class={cn(
        "overflow-auto [scrollbar-width:thin] [scrollbar-color:oklch(1_0_0/12%)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/12 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/20",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
};

export { ScrollArea };
export type { ScrollAreaProps };
