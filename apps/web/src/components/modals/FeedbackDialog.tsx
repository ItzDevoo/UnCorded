import { createSignal } from "solid-js";
import { api } from "../../lib/api.js";
import { showToast } from "../ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
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
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  function resetForm() {
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
          type: "feature",
          title: title().trim(),
          description: description().trim(),
        }),
      });
      showToast("Feature request submitted! Thank you.", "info");
      handleClose();
      props.onSubmitted?.();
    } catch (err) {
      handleApiError(err, "Failed to submit feature request");
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
          <DialogTitle>Submit Feature Request</DialogTitle>
          <DialogDescription>
            Share your idea for a new feature
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <input
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            placeholder="Feature title (max 200 characters)"
            maxLength={200}
            class="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />

          <textarea
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="Describe the feature you'd like to see..."
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
