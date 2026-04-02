import { createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useSession } from "../lib/auth.js";

/** PWA entry point — redirects based on auth state. */
const Launch = () => {
  const session = useSession();
  const navigate = useNavigate();

  createEffect(() => {
    const s = session();
    if (s.isPending) return;
    navigate(s.data?.session ? "/home" : "/login", { replace: true });
  });

  return null;
};

export default Launch;
