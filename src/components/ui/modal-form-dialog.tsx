"use client";

import type { ModalFormDialogProps } from "@/lib/ui-standards";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";

export function ModalFormDialog({
  title,
  description,
  open,
  onOpenChange,
  children,
  footer,
  onSave,
  saveLabel = "Speichern",
  contentClassName,
}: ModalFormDialogProps) {
  const effectiveFooter =
    footer ??
    (onSave ? (
      <Button type="button" onClick={onSave}>
        {saveLabel}
      </Button>
    ) : null);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description ?? title}
      showDescription={Boolean(description)}
      className={contentClassName}
      footer={
        effectiveFooter ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {effectiveFooter}
          </div>
        ) : null
      }
    >
      {children}
    </BottomSheet>
  );
}
