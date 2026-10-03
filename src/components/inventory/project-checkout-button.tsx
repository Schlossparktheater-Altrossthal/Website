"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createCheckoutAction } from "@/app/(members)/mitglieder/lager/actions/checkouts";
import { ArrowRightLeftIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";

/** Legt eine Ausgabe für das Projekt an – die Packliste prüft dann gegen dessen Bedarf. */
export function ProjectCheckoutButton({
  projectId,
  title,
  showId,
  dueAt,
}: {
  projectId: string;
  title: string;
  showId: string | null;
  dueAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await createCheckoutAction({ title, projectId, showId, dueAt });
        setBusy(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        router.push(`${INVENTORY_BASE_PATH}/ausgaben/${result.data.id}`);
      }}
    >
      <ArrowRightLeftIcon className="mr-2 h-4 w-4" />
      {busy ? "Legt an …" : "Ausgabe starten (packen)"}
    </Button>
  );
}
