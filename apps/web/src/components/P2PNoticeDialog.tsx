import { Button } from "./ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog.js";

interface P2PNoticeDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const P2PNoticeDialog = (props: P2PNoticeDialogProps) => {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onCancel();
      }}
    >
      <DialogContent onClose={() => props.onCancel()}>
        <DialogHeader>
          <DialogTitle>Peer-to-Peer File Sharing Notice</DialogTitle>
          <DialogDescription>
            When you share or receive files on UnCorded, transfers happen directly between you and
            the other user. Your IP address will be visible to the other user during the transfer.
            Files never pass through our servers.
          </DialogDescription>
        </DialogHeader>

        <p class="text-sm text-muted-foreground">Do you want to continue?</p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onCancel()}>
            Cancel
          </Button>
          <Button onClick={() => props.onConfirm()}>I Understand</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default P2PNoticeDialog;
