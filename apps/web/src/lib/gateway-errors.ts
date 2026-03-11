import { Opcode, errorEventSchema } from "@uncorded/protocol";
import { onGatewayEvent } from "./gateway.js";
import { showToast } from "../components/ui/toast.js";

const unsub = onGatewayEvent(Opcode.ERROR, (data) => {
  const parsed = errorEventSchema.safeParse(data);
  if (!parsed.success) return;
  showToast(parsed.data.message, "error");
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => unsub());
}
