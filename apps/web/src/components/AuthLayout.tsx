import type { ParentComponent } from "solid-js";

const AuthLayout: ParentComponent = (props) => {
  return (
    <div class="flex min-h-screen items-center justify-center bg-background">
      <div class="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-2xl">
        {props.children}
      </div>
    </div>
  );
};

export default AuthLayout;
