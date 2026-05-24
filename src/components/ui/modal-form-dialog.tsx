"use client";

import type { ModalFormDialogProps } from "@/lib/ui-standards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ModalFormDialog({
  title,
  description,
  open,
  onOpenChange,
  children,
  footer,
  onSave,
  saveLabel = "Speichern",
}: ModalFormDialogProps) {
  const effectiveFooter = footer ?? (onSave ? (
    <Button type="button" onClick={onSave}>{saveLabel}</Button>
  ) : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {effectiveFooter ? <DialogFooter>{effectiveFooter}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
