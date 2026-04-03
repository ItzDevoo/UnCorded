import { createSignal, createEffect, onCleanup, Show, type ParentComponent } from "solid-js";
import { useSession } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { statsSchema, adminsResponseSchema } from "@uncorded/shared";
import type { AdminLevel } from "@uncorded/shared";

const [adminLevel, setAdminLevel] = createSignal<AdminLevel | null>(null);
export { adminLevel };

const AdminGuard: ParentComponent = (props) => {
  const session = useSession();
  const [state, setState] = createSignal<"loading" | "authorized" | "denied">("loading");

  createEffect(() => {
    const s = session();
    if (s.isPending) return;

    setState("loading");

    if (!s.data) {
      setAdminLevel(null);
      setState("denied");
      return;
    }

    const userId = s.data.user.id;
    let active = true;
    onCleanup(() => {
      active = false;
    });

    (async () => {
      try {
        await api("/api/admin/stats", undefined, statsSchema);
        if (!active) return;
        // If we get here, user is an admin. Check level via admins endpoint.
        try {
          const res = await api("/api/admin/admins", undefined, adminsResponseSchema);
          if (!active) return;
          const me = (res as { admins: { userId: string; level: string }[] }).admins.find(
            (a) => a.userId === userId,
          );
          setAdminLevel((me?.level as AdminLevel) ?? "admin");
        } catch {
          if (!active) return;
          setAdminLevel("admin");
        }
        if (!active) return;
        setState("authorized");
      } catch {
        if (!active) return;
        setAdminLevel(null);
        setState("denied");
      }
    })();
  });

  return (
    <Show
      when={state() === "authorized"}
      fallback={
        <Show
          when={state() === "denied"}
          fallback={
            <div class="flex min-h-screen items-center justify-center">
              <p class="text-muted-foreground">Loading...</p>
            </div>
          }
        >
          {(() => {
            window.location.href = "/";
            return null;
          })()}
          <div class="flex min-h-screen items-center justify-center">
            <div class="text-center">
              <h1 class="text-2xl font-bold text-foreground">Access Denied</h1>
              <p class="mt-2 text-muted-foreground">Redirecting...</p>
            </div>
          </div>
        </Show>
      }
    >
      {props.children}
    </Show>
  );
};

export default AdminGuard;
