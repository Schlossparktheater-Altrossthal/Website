"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { unsubscribeAction } from "./actions";

export function UnsubscribeForm({ userId, signature }: { userId: string; signature: string }) {
  const [state, formAction, pending] = useActionState(unsubscribeAction, { done: false });

  if (state.done) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">
          Erledigt – du bekommst keine Zusammenfassungen und keine normalen Hinweise mehr per Mail.
        </p>
        <Link
          href="/mitglieder/profil?bereich=benachrichtigungen"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Einstellungen ansehen oder wieder einschalten
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="u" value={userId} />
      <input type="hidden" name="s" value={signature} />
      <Button type="submit" disabled={pending}>
        {pending ? "Melde ab…" : "Mails abbestellen"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
