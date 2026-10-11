"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { confirmTicketsAction } from "@/app/karten/actions";
import { AsyncButton } from "@/components/ui/async-button";

/** POST statt Link: Mail-Scanner, die Links vorab öffnen, bestätigen so nicht versehentlich. */
export function ConfirmReservationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <AsyncButton
        size="lg"
        className="w-full sm:w-auto"
        isLoading={pending}
        loadingText="Wird bestätigt …"
        onClick={() =>
          startTransition(async () => {
            const result = await confirmTicketsAction(token);
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
      >
        Reservierung bestätigen
      </AsyncButton>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
