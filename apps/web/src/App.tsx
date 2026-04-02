import { lazy, ErrorBoundary } from "solid-js";
import { Router, Route } from "@solidjs/router";
import AppLayout from "./components/AppLayout.js";
import OfflineIndicator from "./components/OfflineIndicator.js";
import InstallPrompt from "./components/InstallPrompt.js";
import "./stores/theme-store.js"; // Initialize theme on app load

// Public pages
const Landing = lazy(() => import("./pages/Landing.js"));
const Launch = lazy(() => import("./pages/Launch.js"));
const Login = lazy(() => import("./pages/Login.js"));
const Register = lazy(() => import("./pages/Register.js"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.js"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.js"));
const Privacy = lazy(() => import("./pages/Privacy.js"));
const Terms = lazy(() => import("./pages/Terms.js"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail.js"));
const Onboarding = lazy(() => import("./pages/Onboarding.js"));

// Authenticated pages
const Home = lazy(() => import("./pages/Home.js"));
const Friends = lazy(() => import("./pages/Friends.js"));
const Messages = lazy(() => import("./pages/Messages.js"));
const DirectMessage = lazy(() => import("./pages/DirectMessage.js"));
const ServerView = lazy(() => import("./pages/ServerView.js"));
const ServerSettings = lazy(() => import("./pages/ServerSettings.js"));
const Features = lazy(() => import("./pages/Feedback.js"));

// Settings (route entry-points under pages/settings/)
const SettingsLayout = lazy(() => import("./pages/SettingsLayout.js"));
const SettingsRedirect = lazy(() => import("./pages/SettingsRedirect.js"));
const ProfileSettings = lazy(() => import("./pages/settings/profile-settings.js"));
const AccountSettings = lazy(() => import("./pages/settings/account-settings.js"));
const AppearanceSettings = lazy(() => import("./pages/settings/appearance-settings.js"));
const TransferHistory = lazy(() => import("./pages/settings/transfer-history.js"));
const BotsSettings = lazy(() => import("./pages/settings/bots-settings.js"));
const PluginsSettings = lazy(() => import("./pages/settings/PluginsSettings.js"));
const PluginConfigure = lazy(() => import("./pages/settings/PluginConfigure.js"));
const NotificationSettings = lazy(() => import("./pages/settings/notification-settings.js"));
const DeveloperSettings = lazy(() => import("./pages/settings/developer-settings.js"));
const Upgrade = lazy(() => import("./pages/Upgrade.js"));
const Billing = lazy(() => import("./pages/Billing.js"));

// 404 page (passes different props to FallbackPage)
const NotFound = lazy(async () => {
  const { default: FallbackPage } = await import("./pages/FallbackPage.js");
  return {
    default: () => (
      <FallbackPage
        title="Not Found"
        description="We couldn't find that page."
        ctaLabel="Go home"
        ctaTarget="/"
      />
    ),
  };
});

const App = () => {
  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
          <h1 class="text-2xl font-bold">Something went wrong</h1>
          <p class="text-muted-foreground">
            {import.meta.env.DEV ? err?.message : "An unexpected error occurred"}
          </p>
          <button
            type="button"
            onClick={reset}
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
          <a href="/" class="text-sm text-muted-foreground underline">
            Go home
          </a>
        </div>
      )}
    >
      <OfflineIndicator />
      <InstallPrompt />
      <Router>
        {/* Public */}
        <Route path="/" component={Landing} />
        <Route path="/launch" component={Launch} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/verify-email" component={VerifyEmail} />

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
            <Route path="/bots" component={BotsSettings} />
            <Route path="/plugins" component={PluginsSettings} />
            <Route path="/plugins/:pluginId" component={PluginConfigure} />
            <Route path="/upgrade" component={Upgrade} />
            <Route path="/billing" component={Billing} />
            <Route path="/notifications" component={NotificationSettings} />
            <Route path="/developer" component={DeveloperSettings} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="/*" component={NotFound} />
      </Router>
    </ErrorBoundary>
  );
};

export default App;
