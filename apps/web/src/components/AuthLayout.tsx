import type { ParentComponent } from "solid-js";

const AuthLayout: ParentComponent = (props) => {
  return (
    <div class="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,oklch(0.22_0.03_155)_0%,transparent_50%)] bg-background">
      <div class="w-full max-w-md animate-fade-in rounded-xl border border-border bg-card p-8 shadow-md">
        <h2 class="mb-6 text-center text-lg font-bold tracking-tight text-primary">UnCorded</h2>
        {props.children}
      </div>
    </div>
  );
};

export default AuthLayout;
