import { lazy } from "solid-js";
import { Router, Route } from "@solidjs/router";
import AdminGuard from "./components/AdminGuard.js";
import AdminLayout from "./components/AdminLayout.js";
import { ToastContainer } from "./components/ui/toast.js";

const Dashboard = lazy(() => import("./pages/Dashboard.js"));
const Users = lazy(() => import("./pages/Users.js"));
const Reports = lazy(() => import("./pages/Reports.js"));
const Feedback = lazy(() => import("./pages/Feedback.js"));
const Admins = lazy(() => import("./pages/Admins.js"));
const AuditLog = lazy(() => import("./pages/AuditLog.js"));

const NotFound = () => (
  <div class="flex min-h-screen items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-foreground">404</h1>
      <p class="mt-2 text-muted-foreground">Page not found</p>
    </div>
  </div>
);

const App = () => {
  return (
    <>
      <Router>
        <Route path="/" component={AdminGuard}>
          <Route path="/" component={AdminLayout}>
            <Route path="/" component={Dashboard} />
            <Route path="/users" component={Users} />
            <Route path="/reports" component={Reports} />
            <Route path="/feedback" component={Feedback} />
            <Route path="/admins" component={Admins} />
            <Route path="/audit-log" component={AuditLog} />
          </Route>
        </Route>
        <Route path="*" component={NotFound} />
      </Router>
      <ToastContainer />
    </>
  );
};

export default App;
