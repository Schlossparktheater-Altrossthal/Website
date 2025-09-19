"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { discardRehearsalDraftAction } from "./actions";

type DiscardDraftButtonProps = {
  id: string;
  title?: string | null;
};

export function DiscardDraftButton({ id, title }: DiscardDraftButtonProps) {
  const router = useRouter();
  const [isDiscarding, startDiscard] = useTransition();

  const handleDiscard = () => {
    const normalizedTitle = title?.trim();
    const confirmationMessage = normalizedTitle
      ? `Möchtest du den Entwurf "${normalizedTitle}" wirklich verwerfen? Diese Aktion kann nicht rückgängig gemacht werden.`
      : "Möchtest du diesen Entwurf wirklich verwerfen? Diese Aktion kann nicht rückgängig gemacht werden.";

    if (!confirm(confirmationMessage)) {
      return;
    }

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
        });
    });
  };

  return (
    <button
      type="button"
      onClick={handleDiscard}
      disabled={isDiscarding}
      className="rounded text-xs font-medium text-destructive underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isDiscarding ? "Verwerfe Entwurf…" : "Entwurf verwerfen"}
    </button>
  );
}
