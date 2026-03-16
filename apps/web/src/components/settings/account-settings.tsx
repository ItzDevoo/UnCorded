import { createSignal, onMount } from "solid-js";
import { api, ApiRequestError } from "../../lib/api.js";
import { signOut } from "../../lib/auth.js";
import { showToast } from "../ui/toast.js";
import { Button } from "../ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog.js";

const AccountSettings = () => {
  const [email, setEmail] = createSignal("");
  const [emailLoading, setEmailLoading] = createSignal(true);
  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [changingPassword, setChangingPassword] = createSignal(false);
  const [showDeleteDialog, setShowDeleteDialog] = createSignal(false);
  const [deletePassword, setDeletePassword] = createSignal("");
  const [deleting, setDeleting] = createSignal(false);

  onMount(async () => {
    try {
      const me = await api<{ email: string }>("/api/users/@me");
      setEmail(me.email);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[settings] Failed to fetch user email:", err);
    } finally {
      setEmailLoading(false);
    }
  });

  async function handleChangePassword() {
    if (changingPassword()) return;

    if (!currentPassword() || !newPassword()) {
      showToast("Please fill in all password fields", "error");
      return;
    }

    if (newPassword().length < 8) {
      showToast("New password must be at least 8 characters", "error");
      return;
    }

    if (newPassword() !== confirmPassword()) {
      showToast("Passwords do not match", "error");
      return;
    }

    setChangingPassword(true);
    try {
      await api("/api/users/@me/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: currentPassword(),
          newPassword: newPassword(),
        }),
      });
      showToast("Password changed successfully", "info");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.body.message : "Failed to change password";
      showToast(message, "error");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleting()) return;

    if (!deletePassword()) {
      showToast("Please enter your password", "error");
      return;
    }

    setDeleting(true);
    try {
      await api("/api/users/@me", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword() }),
      });
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.body.message : "Failed to delete account";
      showToast(message, "error");
      setDeleting(false);
      return;
    }

    // Account deleted — sign out and redirect (ignore errors, redirect clears session)
    try {
      await signOut();
    } catch {
      // Session cleanup is best-effort
    }
    window.location.href = "/";
  }

  return (
    <div class="space-y-8">
      {/* Email */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Email
        </h3>
        <div class="rounded-lg border border-border bg-card p-4">
          <p class="text-sm text-foreground">
            {emailLoading() ? "Loading..." : email() || "Unavailable"}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            Contact support to change your email address.
          </p>
        </div>
      </div>

      {/* Password */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Password
        </h3>
        <div class="space-y-3">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground" for="current-password">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword()}
              onInput={(e) => setCurrentPassword(e.currentTarget.value)}
              class="block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
              autocomplete="current-password"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground" for="new-password">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword()}
              onInput={(e) => setNewPassword(e.currentTarget.value)}
              class="block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
              autocomplete="new-password"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground" for="confirm-password">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword()}
              onInput={(e) => setConfirmPassword(e.currentTarget.value)}
              class="block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
              autocomplete="new-password"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword()}>
            {changingPassword() ? "Changing..." : "Change Password"}
          </Button>
        </div>
      </div>

      {/* Connected accounts */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Connected Accounts
        </h3>
        <div class="space-y-2">
          <div class="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div class="flex items-center gap-3">
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2]">
                <svg
                  class="h-4 w-4 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
              </div>
              <span class="text-sm text-foreground">Discord</span>
            </div>
            <span class="text-xs text-muted-foreground">Coming soon</span>
          </div>
          <div class="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div class="flex items-center gap-3">
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              <span class="text-sm text-foreground">Google</span>
            </div>
            <span class="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-destructive-foreground">
          Danger Zone
        </h3>
        <div class="rounded-lg border border-destructive/30 p-4">
          <p class="mb-3 text-sm text-foreground">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              setDeletePassword("");
              setShowDeleteDialog(true);
            }}
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteDialog()}
        onOpenChange={(open) => {
          if (!open) setDeletePassword("");
          setShowDeleteDialog(open);
        }}
      >
        <DialogContent
          onClose={() => {
            setDeletePassword("");
            setShowDeleteDialog(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account, messages, and all associated data. Enter
              your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <div class="my-4">
            <label class="mb-1.5 block text-sm font-medium text-foreground" for="delete-password">
              Password
            </label>
            <input
              id="delete-password"
              type="password"
              value={deletePassword()}
              onInput={(e) => setDeletePassword(e.currentTarget.value)}
              class="block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
              autocomplete="current-password"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeletePassword("");
                setShowDeleteDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting()}>
              {deleting() ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountSettings;
