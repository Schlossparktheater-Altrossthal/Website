"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";

import { createRehearsalDraftAction } from "./actions";

export function CreateRehearsalButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      createRehearsalDraftAction()
        .then((result) => {
          if (result?.success && result.id) {
            toast.success("Entwurf erstellt. Du kannst die Details jetzt ausfüllen.");
            router.push(`/mitglieder/probenplanung/proben/${result.id}`);
          } else {
            toast.error(result?.error ?? "Der Entwurf konnte nicht erstellt werden.");
          }
        })
        .catch(() => {
          toast.error("Der Entwurf konnte nicht erstellt werden.");
        });
    });
  };

  return (
    <AsyncButton
      type="button"
      onClick={handleClick}
      isLoading={isPending}
      loadingText="Entwurf wird vorbereitet…"
    >
      Neue Probe anlegen
    </AsyncButton>
  );
}
