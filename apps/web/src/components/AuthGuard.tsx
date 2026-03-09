import { createEffect, type ParentComponent } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useSession } from "../lib/auth.js";

const AuthGuard: ParentComponent = (props) => {
  const session = useSession();
  const navigate = useNavigate();

  createEffect(() => {
    const s = session();
    if (!s.isPending && !s.data) {
      navigate("/login", { replace: true });
    }
  });

  return <>{props.children}</>;
};

export default AuthGuard;
