import { lazy } from "solid-js";
import { Router, Route } from "@solidjs/router";
import AppLayout from "./components/AppLayout.js";

const Landing = lazy(() => import("./pages/Landing.js"));
const Login = lazy(() => import("./pages/Login.js"));
const Register = lazy(() => import("./pages/Register.js"));
const Home = lazy(() => import("./pages/Home.js"));
const Friends = lazy(() => import("./pages/Friends.js"));

const App = () => {
  return (
    <Router>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/home" component={AppLayout}>
        <Route path="/" component={Home} />
        <Route path="/friends" component={Friends} />
      </Route>
    </Router>
  );
};

export default App;
