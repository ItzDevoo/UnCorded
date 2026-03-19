import { createSignal } from "solid-js";
import { api, ApiRequestError } from "../../lib/api.js";
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

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

const FeedbackDialog = (props: FeedbackDialogProps) => {
  const [type, setType] = createSignal<"feature" | "bug">("feature");
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  function resetForm() {
    setType("feature");
    setTitle("");
    setDescription("");
  }

  function handleClose() {
    resetForm();
    props.onClose();
  }

  async function handleSubmit() {
    if (submitting()) return;
    if (!title().trim() || !description().trim()) {
      showToast("Please fill in all fields", "error");
      return;
    }

    setSubmitting(true);
    try {
      await api("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          type: type(),
          title: title().trim(),
          description: description().trim(),
        }),
      });
      showToast("Feedback submitted! Thank you.", "info");
      handleClose();
      props.onSubmitted?.();
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.body.message : "Failed to submit feedback";
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
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>
            Share a feature request or report a bug
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <div class="flex gap-2">
            <button
              class={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                type() === "feature"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
              onClick={() => setType("feature")}
            >
              Feature Request
            </button>
            <button
              class={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                type() === "bug"
                  ? "bg-destructive text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
              onClick={() => setType("bug")}
            >
              Bug Report
            </button>
          </div>

          <input
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            placeholder="Title (max 200 characters)"
            maxLength={200}
            class="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />

          <textarea
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="Describe your feature request or bug in detail..."
            maxLength={2000}
            rows={5}
            class="block w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />

          <p class="text-xs text-muted-foreground text-right">
            {description().length}/2000
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting()}>
            {submitting() ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDialog;
