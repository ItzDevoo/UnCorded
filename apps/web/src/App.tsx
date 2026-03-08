import { lazy, Show } from "solid-js";
import { Router, Route, Navigate } from "@solidjs/router";
import { useSession } from "./lib/auth.js";
import AppLayout from "./components/AppLayout.js";

const Login = lazy(() => import("./pages/Login.js"));
const Register = lazy(() => import("./pages/Register.js"));
const Home = lazy(() => import("./pages/Home.js"));

const RootRedirect = () => {
  const session = useSession();

  return (
    <Show when={!session().isPending}>
      <Show when={session().data} fallback={<Navigate href="/login" />}>
        <Navigate href="/app" />
      </Show>
    </Show>
  );
};

const App = () => {
  return (
    <Router>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/app" component={AppLayout}>
        <Route path="/" component={Home} />
      </Route>
    </Router>
  );
};

export default App;
