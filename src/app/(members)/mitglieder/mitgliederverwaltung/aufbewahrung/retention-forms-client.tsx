"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

export function PurgeButton({ kind, count }: { kind: "dietary" | "photoConsents"; count: number }) {
  const action = useCallback(
    async () =>
      kind === "dietary" ? purgeExpiredDietaryAction() : purgeExpiredPhotoConsentsAction(),
    [kind],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  useResultToast(state);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const label =
    kind === "dietary"
      ? "Ernährungs-, Allergie- und Abneigungsdaten löschen"
      : "Fotoerlaubnisse löschen";

  // Die Bestätigung stößt dieselbe Action an, damit `useActionState` Zustand und
  // Ladeanzeige weiterhin steuert.
  const submitConfirmed = () => {
    setConfirmOpen(false);
    formAction();
  };

  return (
    <>
      <form action={formAction}>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending || count === 0}
          onClick={() => setConfirmOpen(true)}
        >
          {label} ({count})
        </Button>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submitConfirmed}
        title={label}
        description={`${label} (${count})? Das lässt sich nicht rückgängig machen.`}
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
      />
    </>
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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submitConfirmed = () => {
    setConfirmOpen(false);
    const form = formRef.current;
    if (form) formAction(new FormData(form));
  };

  return (
    <>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Anonymisieren
        </Button>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submitConfirmed}
        title="Konto anonymisieren"
        description={`Konto von ${name} anonymisieren? Name, Kontakt-, Gesundheits- und Zahlungsdaten werden gelöscht. Das lässt sich nicht rückgängig machen.`}
        confirmLabel="Anonymisieren"
        cancelLabel="Abbrechen"
        variant="destructive"
      />
    </>
  );
}
