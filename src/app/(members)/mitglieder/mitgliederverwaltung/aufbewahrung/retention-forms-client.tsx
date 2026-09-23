"use client";

import { useActionState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  anonymizeExpiredAccountAction,
  purgeExpiredDietaryAction,
  purgeExpiredPhotoConsentsAction,
  type RetentionActionResult,
} from "./actions";

const INITIAL_STATE: RetentionActionResult = { ok: false, error: "" };

function useResultToast(state: RetentionActionResult) {
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (state.ok) toast.success(state.message);
    else if (state.error) toast.error(state.error);
  }, [state]);
}

function confirmOrCancel(message: string) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };
}

export function PurgeButton({ kind, count }: { kind: "dietary" | "photoConsents"; count: number }) {
  const action = useCallback(
    async () =>
      kind === "dietary" ? purgeExpiredDietaryAction() : purgeExpiredPhotoConsentsAction(),
    [kind],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  useResultToast(state);
  const label =
    kind === "dietary" ? "Ernährungs-/Allergiedaten löschen" : "Fotoerlaubnisse löschen";

  return (
    <form
      action={formAction}
      onSubmit={confirmOrCancel(`${label} (${count})? Das lässt sich nicht rückgängig machen.`)}
    >
      <Button type="submit" size="sm" variant="destructive" disabled={isPending || count === 0}>
        {label} ({count})
      </Button>
    </form>
  );
}

export function AnonymizeButton({ userId, name }: { userId: string; name: string }) {
  const action = useCallback(
    async (_state: RetentionActionResult, formData: FormData) =>
      anonymizeExpiredAccountAction(formData),
    [],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  useResultToast(state);

  return (
    <form
      action={formAction}
      onSubmit={confirmOrCancel(
        `Konto von ${name} anonymisieren? Name, Kontakt-, Gesundheits- und Zahlungsdaten werden gelöscht. Das lässt sich nicht rückgängig machen.`,
      )}
    >
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
        Anonymisieren
      </Button>
    </form>
  );
}
