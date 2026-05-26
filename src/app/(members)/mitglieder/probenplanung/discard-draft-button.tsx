"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { discardRehearsalDraftAction } from "./actions";

type DiscardDraftButtonProps = {
  id: string;
  title?: string | null;
};

export function DiscardDraftButton({ id, title }: DiscardDraftButtonProps) {
  const router = useRouter();
  const [isDiscarding, startDiscard] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const normalizedTitle = title?.trim();
  const confirmationMessage = normalizedTitle
    ? `Möchtest du den Entwurf "${normalizedTitle}" wirklich verwerfen? Diese Aktion kann nicht rückgängig gemacht werden.`
    : "Möchtest du diesen Entwurf wirklich verwerfen? Diese Aktion kann nicht rückgängig gemacht werden.";

  const handleDiscard = () => {
    startDiscard(() => {
      discardRehearsalDraftAction({ id })
        .then((result) => {
          if (result?.success) {
            toast.success("Entwurf verworfen.");
            router.refresh();
          } else {
            toast.error(result?.error ?? "Der Entwurf konnte nicht verworfen werden.");
          }
        })
        .catch(() => {
          toast.error("Der Entwurf konnte nicht verworfen werden.");
        })
        .finally(() => {
          setConfirmOpen(false);
        });
    });
  };

  return (
    <>
      <AsyncButton
        type="button"
        variant="destructive"
        onClick={() => setConfirmOpen(true)}
        isLoading={isDiscarding}
        loadingText="Verwerfe Entwurf…"
      >
        Entwurf verwerfen
      </AsyncButton>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDiscard}
        title="Entwurf verwerfen?"
        description={confirmationMessage}
        confirmLabel="Verwerfen"
        cancelLabel="Abbrechen"
        variant="destructive"
      />
    </>
  );
}
