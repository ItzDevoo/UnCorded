import { readyData } from "../lib/gateway-store.js";

const Home = () => {
  const username = () => readyData.data?.user.displayName ?? readyData.data?.user.username;

  return (
    <div class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 class="text-2xl font-bold text-foreground">
        Welcome back{username() ? `, ${username()}` : ""}
      </h1>
      <p class="max-w-md text-sm text-muted-foreground">
        Select a server from the sidebar or start a DM to begin chatting.
      </p>
    </div>
  );
};

export default Home;
