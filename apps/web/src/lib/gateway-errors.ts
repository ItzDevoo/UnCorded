import { z } from "zod";
import { Opcode } from "@uncorded/protocol";
import { onGatewayEvent } from "./gateway.js";
import { showToast } from "../components/ui/toast.js";

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const unsub = onGatewayEvent(Opcode.ERROR, (data) => {
  const parsed = errorSchema.safeParse(data);
  if (!parsed.success) return;
  showToast(parsed.data.message, "error");
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => unsub());
}
