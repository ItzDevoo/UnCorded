import { onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";

const SettingsRedirect = () => {
  const navigate = useNavigate();
  onMount(() => navigate("/settings/profile", { replace: true }));
  return null;
};

export default SettingsRedirect;
