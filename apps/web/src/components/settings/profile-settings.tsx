import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import { MAX_AVATAR_SIZE_BYTES, ALLOWED_AVATAR_TYPES, DISPLAY_NAME_MAX } from "@uncorded/shared";
import { api, apiUpload, ApiRequestError } from "../../lib/api.js";
import { readyData, updateCurrentUser } from "../../lib/gateway-store.js";
import { showToast } from "../ui/toast.js";
import { Button } from "../ui/button.js";

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

const ProfileSettings = () => {
  const user = () => readyData.data?.user;

  const [username, setUsername] = createSignal(user()?.username ?? "");
  const [displayName, setDisplayName] = createSignal(user()?.displayName ?? "");

  // Sync form fields on first load only — local edits are authoritative after init
  let initialized = false;
  createEffect(() => {
    const u = user();
    if (!u) return;
    if (initialized) return;
    initialized = true;
    setUsername(u.username ?? "");
    setDisplayName(u.displayName ?? "");
  });

  const [avatarFile, setAvatarFile] = createSignal<File | null>(null);
  const [avatarPreview, setAvatarPreview] = createSignal<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [usernameError, setUsernameError] = createSignal("");

  // Clean up object URL on unmount
  onCleanup(() => {
    const url = avatarPreview();
    if (url) URL.revokeObjectURL(url);
  });

  function validateUsername(val: string): string {
    if (val.length < 2) return "Username must be at least 2 characters";
    if (val.length > 32) return "Username must be at most 32 characters";
    if (!USERNAME_RE.test(val)) return "Only letters, numbers, and underscores";
    return "";
  }

  function handleUsernameInput(val: string) {
    setUsername(val);
    setUsernameError(validateUsername(val));
  }

  function handleFileSelect(file: File) {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
      showToast("Invalid file type. Use PNG, JPEG, GIF, or WebP.", "error");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      showToast("File too large. Maximum size is 4 MB.", "error");
      return;
    }

    // Clean up previous preview
    const prev = avatarPreview();
    if (prev) URL.revokeObjectURL(prev);

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFileSelect(file);
    input.value = "";
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) handleFileSelect(file);
  }

  function handleRemoveAvatar() {
    const prev = avatarPreview();
    if (prev) URL.revokeObjectURL(prev);
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
  }

  async function handleSave() {
    if (saving()) return;

    const validationErr = validateUsername(username());
    if (validationErr) {
      setUsernameError(validationErr);
      return;
    }

    setSaving(true);
    try {
      // Upload avatar if changed
      if (avatarFile()) {
        const formData = new FormData();
        formData.append("avatar", avatarFile()!);
        const result = await apiUpload<{ avatarUrl: string }>("/api/users/@me/avatar", formData);
        updateCurrentUser({ avatarUrl: result.avatarUrl });
        setAvatarFile(null);
        const prev = avatarPreview();
        if (prev) URL.revokeObjectURL(prev);
        setAvatarPreview(null);
      } else if (removeAvatar()) {
        await api("/api/users/@me/avatar", { method: "DELETE" });
        updateCurrentUser({ avatarUrl: null });
        setRemoveAvatar(false);
      }

      // Update profile fields
      const body: Record<string, string | null> = {};
      if (username() !== user()?.username) body.username = username();
      if (displayName() !== (user()?.displayName ?? "")) {
        body.displayName = displayName() || null;
      }

      if (Object.keys(body).length > 0) {
        const result = await api<{ username: string; displayName: string | null }>(
          "/api/users/@me",
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        );
        updateCurrentUser({
          username: result.username,
          displayName: result.displayName,
        });
      }

      showToast("Profile updated", "info");
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.body.message : "Failed to save";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  const currentAvatarUrl = () => {
    if (removeAvatar()) return null;
    return avatarPreview() ?? user()?.avatarUrl ?? null;
  };

  const initial = () => {
    const name = displayName() || username() || "?";
    return name[0]?.toUpperCase() ?? "?";
  };

  return (
    <div class="space-y-8">
      {/* Avatar section */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Avatar
        </h3>
        <div class="flex items-center gap-6">
          <div
            role="button"
            tabIndex={0}
            aria-label="Change avatar"
            class="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => document.getElementById("avatar-input")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                document.getElementById("avatar-input")?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <Show
              when={currentAvatarUrl()}
              fallback={
                <div class="flex h-full w-full items-center justify-center bg-primary/15 text-2xl font-bold text-primary">
                  {initial()}
                </div>
              }
            >
              {(url) => <img src={url()} alt="Avatar" class="h-full w-full object-cover" />}
            </Show>
            <div class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <input
              id="avatar-input"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              class="hidden"
              onChange={handleFileInput}
            />
          </div>
          <div class="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("avatar-input")?.click()}
            >
              Upload
            </Button>
            <Show when={user()?.avatarUrl || avatarFile()}>
              <Button variant="ghost" size="sm" onClick={handleRemoveAvatar}>
                Remove
              </Button>
            </Show>
            <p class="text-xs text-muted-foreground">PNG, JPEG, GIF, or WebP. Max 4 MB.</p>
          </div>
        </div>
      </div>

      {/* Username */}
      <div>
        <label class="mb-1.5 block text-sm font-medium text-foreground" for="settings-username">
          Username
        </label>
        <input
          id="settings-username"
          type="text"
          value={username()}
          onInput={(e) => handleUsernameInput(e.currentTarget.value)}
          maxLength={32}
          class="block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
        />
        <Show when={usernameError()}>
          <p class="mt-1 text-xs text-destructive-foreground">{usernameError()}</p>
        </Show>
      </div>

      {/* Display name */}
      <div>
        <label class="mb-1.5 block text-sm font-medium text-foreground" for="settings-display-name">
          Display Name
        </label>
        <input
          id="settings-display-name"
          type="text"
          value={displayName()}
          onInput={(e) => setDisplayName(e.currentTarget.value)}
          maxLength={DISPLAY_NAME_MAX}
          placeholder="How others see you"
          class="block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
        />
        <p class="mt-1 text-xs text-muted-foreground">
          Optional. If empty, your username is shown.
        </p>
      </div>

      {/* Preview card */}
      <div>
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Preview
        </h3>
        <div class="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
          <Show
            when={currentAvatarUrl()}
            fallback={
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {initial()}
              </div>
            }
          >
            {(url) => (
              <img src={url()} alt="Preview" class="h-10 w-10 shrink-0 rounded-full object-cover" />
            )}
          </Show>
          <div>
            <div class="text-sm font-semibold text-foreground">
              {displayName() || username() || "Unknown"}
            </div>
            <div class="text-xs text-muted-foreground">@{username() || "username"}</div>
          </div>
        </div>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving() || !!usernameError()}>
        {saving() ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
};

export default ProfileSettings;
