"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EmergencyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  rehearsalTitle?: string;
}

export function EmergencyDialog({ isOpen, onClose, onSubmit, rehearsalTitle }: EmergencyDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Bitte geben Sie einen Grund für die Emergency-Absage an");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(trimmed);
      toast.success("Notfall wurde gemeldet.");
      setReason("");
      onClose();
    } catch (error) {
      console.error("[EmergencyDialog] Failed to submit emergency reason", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Emergency-Absage</DialogTitle>
          <DialogDescription>
            Bitte geben Sie einen triftigen Grund für die kurzfristige Absage an.
            {rehearsalTitle ? (
              <span className="mt-1 block text-xs text-muted-foreground">{rehearsalTitle}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Begründung</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="z.B. Krankheit, familiärer Notfall, etc."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? "Wird gesendet..." : "Absagen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
