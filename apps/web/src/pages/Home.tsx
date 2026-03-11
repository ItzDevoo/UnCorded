import { onMount } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { readyData } from "../lib/gateway-store.js";
import { showToast } from "../components/ui/toast.js";

const Home = () => {
  const username = () => readyData.data?.user.displayName ?? readyData.data?.user.username;
  const [searchParams, setSearchParams] = useSearchParams();

  onMount(() => {
    const checkout = searchParams.checkout;
    if (checkout === "success") {
      showToast("Subscription activated!", "info");
    } else if (checkout === "cancelled") {
      showToast("Checkout cancelled.", "info");
    }
    if (checkout) {
      setSearchParams({ checkout: undefined }, { replace: true });
    }
  });

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
