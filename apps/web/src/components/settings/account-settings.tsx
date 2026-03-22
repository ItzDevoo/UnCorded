import { createSignal, For, onMount } from "solid-js";
import { api, ApiRequestError } from "../../lib/api.js";
import { authClient, signIn } from "../../lib/auth.js";
import { showToast } from "../ui/toast.js";
import { Button } from "../ui/button.js";
import { GoogleIcon, DiscordIcon } from "../ui/oauth-buttons.js";
import { showPendingDeletion } from "../../stores/deletion-store.js";
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
  const [linkedProviders, setLinkedProviders] = createSignal<Set<string>>(new Set());
  const [accountsLoading, setAccountsLoading] = createSignal(true);
  const [unlinking, setUnlinking] = createSignal<string | null>(null);
  const [connecting, setConnecting] = createSignal(false);
  const [accountsFetchError, setAccountsFetchError] = createSignal(false);

  async function fetchLinkedAccounts() {
    setAccountsFetchError(false);
    setAccountsLoading(true);
    try {
      const result = await authClient.listAccounts();
      if (result.data) {
        const providers = new Set<string>();
        for (const account of result.data) {
          providers.add(account.providerId);
        }
        setLinkedProviders(providers);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("[settings] Failed to fetch accounts:", err);
      setAccountsFetchError(true);
    } finally {
      setAccountsLoading(false);
    }
  }

  onMount(async () => {
    // After OAuth link redirect, force session refresh and clean up URL
    const params = new URLSearchParams(window.location.search);
    if (params.has("linked")) {
      params.delete("linked");
      const clean = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
      window.history.replaceState(null, "", clean);
      // Force the auth client to re-read the session cookie (best-effort)
      try {
        await authClient.getSession({ fetchOptions: { throw: false } });
      } catch {
        if (import.meta.env.DEV) console.error("[settings] Session refresh after link failed");
      }
    }

    try {
      const me = await api<{ email: string }>("/api/users/@me");
      setEmail(me.email);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[settings] Failed to fetch user email:", err);
    } finally {
      setEmailLoading(false);
    }
    fetchLinkedAccounts();
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

  function totalAuthMethods(): number {
    let count = linkedProviders().size;
    // "credential" is counted in the set if the user has email/password
    return count;
  }

  async function handleConnect(provider: "google" | "discord") {
    setConnecting(true);
    try {
      await signIn.social({ provider, callbackURL: `${window.location.origin}/home/settings?linked=1` });
    } catch {
      showToast("Failed to connect account", "error");
      setConnecting(false);
    }
  }

  async function handleDisconnect(providerId: string) {
    if (unlinking()) return;
    if (totalAuthMethods() <= 1) {
      showToast("Can't disconnect — this is your only sign-in method", "error");
      return;
    }

    setUnlinking(providerId);
    try {
      const result = await authClient.unlinkAccount({ providerId });
      if (result.error) {
        showToast(result.error.message ?? "Failed to disconnect account", "error");
      } else {
        const updated = new Set(linkedProviders());
        updated.delete(providerId);
        setLinkedProviders(updated);
        showToast("Account disconnected", "info");
      }
    } catch {
      showToast("Failed to disconnect account", "error");
    } finally {
      setUnlinking(null);
    }
  }

  async function handleDeleteAccount() {
    if (deleting()) return;

    if (!deletePassword()) {
      showToast("Please enter your password", "error");
      return;
    }

    setDeleting(true);
    let expiresAt: string | undefined;
    try {
      const res = await api<{ success: boolean; pending?: boolean; expiresAt?: string }>(
        "/api/users/@me",
        {
          method: "DELETE",
          body: JSON.stringify({ password: deletePassword() }),
        },
      );
      expiresAt = res.expiresAt;
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.body.message : "Failed to delete account";
      showToast(message, "error");
      setDeleting(false);
      return;
    }

    // Show countdown immediately from REST response (WS frame reconciles later)
    if (expiresAt) {
      showPendingDeletion(expiresAt);
    }
    setDeletePassword("");
    setShowDeleteDialog(false);
    setDeleting(false);
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
        {accountsFetchError() ? (
          <div class="rounded-lg border border-border bg-card p-4 text-center">
            <p class="text-sm text-muted-foreground">Failed to load connected accounts.</p>
            <Button variant="outline" size="sm" class="mt-2" onClick={fetchLinkedAccounts}>
              Retry
            </Button>
          </div>
        ) : (
        <div class="space-y-2">
          <For
            each={
              [
                { id: "discord", name: "Discord", bgClass: "bg-[#5865F2] text-white", icon: DiscordIcon },
                { id: "google", name: "Google", bgClass: "bg-white text-foreground", icon: GoogleIcon },
              ] as const
            }
          >
            {(provider) => {
              const connected = () => linkedProviders().has(provider.id);
              const isUnlinking = () => unlinking() === provider.id;
              return (
                <div class="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div class="flex items-center gap-3">
                    <div
                      class={`flex h-8 w-8 items-center justify-center rounded-full ${provider.bgClass}`}
                    >
                      <provider.icon />
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-foreground">{provider.name}</span>
                      {connected() && (
                        <span class="flex items-center gap-1 text-xs text-success-foreground">
                          <svg
                            class="h-3 w-3"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            aria-hidden="true"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                          Connected
                        </span>
                      )}
                    </div>
                  </div>
                  {accountsLoading() ? (
                    <span class="text-xs text-muted-foreground">Loading...</span>
                  ) : connected() ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!unlinking()}
                      onClick={() => handleDisconnect(provider.id)}
                    >
                      {isUnlinking() ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={connecting()}
                      onClick={() => handleConnect(provider.id)}
                    >
                      {connecting() ? "Connecting..." : "Connect"}
                    </Button>
                  )}
                </div>
              );
            }}
          </For>
        </div>
        )}
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
