import { lazy } from "solid-js";
import { Router, Route } from "@solidjs/router";
import AppLayout from "./components/AppLayout.js";
import "./stores/theme-store.js"; // Initialize theme on app load

// Public pages
const Landing = lazy(() => import("./pages/Landing.js"));
const Login = lazy(() => import("./pages/Login.js"));
const Register = lazy(() => import("./pages/Register.js"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.js"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.js"));
const Privacy = lazy(() => import("./pages/Privacy.js"));
const Terms = lazy(() => import("./pages/Terms.js"));
const Onboarding = lazy(() => import("./pages/Onboarding.js"));

// Authenticated pages
const Home = lazy(() => import("./pages/Home.js"));
const Friends = lazy(() => import("./pages/Friends.js"));
const Messages = lazy(() => import("./pages/Messages.js"));
const DirectMessage = lazy(() => import("./pages/DirectMessage.js"));
const ServerView = lazy(() => import("./pages/ServerView.js"));
const ServerSettings = lazy(() => import("./pages/ServerSettings.js"));
const Features = lazy(() => import("./pages/Feedback.js"));

// Settings
const SettingsLayout = lazy(() => import("./pages/SettingsLayout.js"));
const SettingsRedirect = lazy(() => import("./pages/SettingsRedirect.js"));
const ProfileSettings = lazy(() => import("./components/settings/profile-settings.js"));
const AccountSettings = lazy(() => import("./components/settings/account-settings.js"));
const AppearanceSettings = lazy(() => import("./components/settings/appearance-settings.js"));
const TransferHistory = lazy(() => import("./components/settings/transfer-history.js"));
const Upgrade = lazy(() => import("./pages/Upgrade.js"));
const Billing = lazy(() => import("./pages/Billing.js"));
const FallbackPage = lazy(() => import("./pages/FallbackPage.js"));

const App = () => {
  return (
    <Router>
      {/* Public */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />

      {/* Authenticated — all under AppLayout with AuthGuard */}
      <Route path="/" component={AppLayout}>
        <Route path="/home" component={Home} />
        <Route path="/friends" component={Friends} />
        <Route path="/messages" component={Messages} />
        <Route path="/messages/:userId" component={DirectMessage} />
        <Route path="/servers/:serverId" component={ServerView} />
        <Route path="/servers/:serverId/settings" component={ServerSettings} />
        <Route path="/features" component={Features} />
        <Route path="/settings" component={SettingsLayout}>
          <Route path="/" component={SettingsRedirect} />
          <Route path="/profile" component={ProfileSettings} />
          <Route path="/account" component={AccountSettings} />
          <Route path="/appearance" component={AppearanceSettings} />
          <Route path="/transfers" component={TransferHistory} />
          <Route path="/upgrade" component={Upgrade} />
          <Route path="/billing" component={Billing} />
          <Route path="/notifications" component={FallbackPage} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="/*" component={FallbackPage} />
    </Router>
  );
};

export default App;
