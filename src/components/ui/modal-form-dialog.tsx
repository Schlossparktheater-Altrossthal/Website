"use client";

import type { ModalFormDialogProps } from "@/lib/ui-standards";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";

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
  const effectiveFooter =
    footer ??
    (onSave ? (
      <Button type="button" onClick={onSave}>
        {saveLabel}
      </Button>
    ) : null);

  const isDesktop = useMediaQuery("(min-width: 640px)");

  // Mobil als Blatt von unten (wie die Tagesansicht im Kalender), ab 640px als zentrierter Dialog.
  if (!isDesktop) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description ?? title}
        showDescription={Boolean(description)}
        footer={effectiveFooter}
      >
        {children}
      </BottomSheet>
    );
  }

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
