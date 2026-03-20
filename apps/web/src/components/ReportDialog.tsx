import { createSignal, For } from "solid-js";
import { api, ApiRequestError } from "../lib/api.js";
import { showToast } from "./ui/toast.js";
import { Button } from "./ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog.js";

const CATEGORIES = [
  { value: "csam", label: "Child Safety (CSAM)" },
  { value: "intimate_image", label: "Non-Consensual Intimate Image" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "copyright", label: "Copyright Violation" },
  { value: "malware", label: "Malware" },
  { value: "other", label: "Other" },
] as const;

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  messageId: string;
}

const ReportDialog = (props: ReportDialogProps) => {
  const [category, setCategory] = createSignal("harassment");
  const [details, setDetails] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  function resetForm() {
    setCategory("harassment");
    setDetails("");
  }

  function handleClose() {
    resetForm();
    props.onClose();
  }

  async function handleSubmit() {
    if (submitting()) return;
    setSubmitting(true);
    try {
      await api("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          type: "message",
          messageId: props.messageId,
          category: category(),
          details: details().trim() || undefined,
        }),
      });
      showToast("Report submitted", "info");
      handleClose();
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.body.message : "Failed to submit report";
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Report Message</DialogTitle>
          <DialogDescription>Why are you reporting this message?</DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <select
            value={category()}
            onChange={(e) => setCategory(e.currentTarget.value)}
            class="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
          >
            <For each={CATEGORIES}>{(cat) => <option value={cat.value}>{cat.label}</option>}</For>
          </select>

          <textarea
            value={details()}
            onInput={(e) => setDetails(e.currentTarget.value)}
            placeholder="Additional details (optional)"
            maxLength={1000}
            rows={3}
            class="block w-full resize-none rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting()}>
            {submitting() ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
