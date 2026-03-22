import { lazy } from "solid-js";
import { Router, Route } from "@solidjs/router";
import AppLayout from "./components/AppLayout.js";
import "./stores/theme-store.js"; // Initialize theme on app load

const Landing = lazy(() => import("./pages/Landing.js"));
const Login = lazy(() => import("./pages/Login.js"));
const Register = lazy(() => import("./pages/Register.js"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.js"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.js"));
const Privacy = lazy(() => import("./pages/Privacy.js"));
const Terms = lazy(() => import("./pages/Terms.js"));
const Onboarding = lazy(() => import("./pages/Onboarding.js"));
const Home = lazy(() => import("./pages/Home.js"));
const Friends = lazy(() => import("./pages/Friends.js"));
const Settings = lazy(() => import("./pages/Settings.js"));
const ServerSettings = lazy(() => import("./pages/ServerSettings.js"));
const Feedback = lazy(() => import("./pages/Feedback.js"));

const App = () => {
  return (
    <Router>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/home" component={AppLayout}>
        <Route path="/" component={Home} />
        <Route path="/friends" component={Friends} />
        <Route path="/settings" component={Settings} />
        <Route path="/server-settings" component={ServerSettings} />
        <Route path="/feedback" component={Feedback} />
      </Route>
    </Router>
  );
};

export default App;
