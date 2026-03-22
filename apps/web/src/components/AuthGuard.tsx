import { createEffect, type ParentComponent } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { useSession } from "../lib/auth.js";

const AuthGuard: ParentComponent = (props) => {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  createEffect(() => {
    const s = session();
    if (s.isPending) return;

    if (!s.data) {
      navigate("/login", { replace: true });
      return;
    }

    // OAuth users without a username need onboarding
    if (!s.data.user.username && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
  });

  return <>{props.children}</>;
};

export default AuthGuard;
