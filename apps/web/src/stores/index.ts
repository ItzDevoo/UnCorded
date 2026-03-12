import { setupMessageStore } from "./message-store.js";
import { setupFileStore } from "./file-store.js";
import { setupServerStore } from "./server-store.js";
import { setupFriendStore } from "./friend-store.js";
import { setupMemberStore } from "./member-store.js";
import { setupPresenceStore } from "./presence-store.js";

export {
  setupMessageStore,
  setupFileStore,
  setupServerStore,
  setupFriendStore,
  setupMemberStore,
  setupPresenceStore,
};

export function setupStores() {
  setupMessageStore();
  setupFileStore();
  setupServerStore();
  setupFriendStore();
  setupMemberStore();
  setupPresenceStore();
}
