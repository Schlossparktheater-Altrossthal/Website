"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { restoreRevisionAction } from "@/app/(members)/mitglieder/rezepte/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function RestoreRevisionButton({
  recipeId,
  version,
}: {
  recipeId: string;
  version: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen(true)}>
        Wiederherstellen
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Version ${version} wiederherstellen?`}
        description="Der aktuelle Stand bleibt im Verlauf erhalten."
        confirmLabel="Wiederherstellen"
        cancelLabel="Abbrechen"
        variant="default"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          startTransition(async () => {
            const result = await restoreRevisionAction(recipeId, version);
            if (!result.ok) {
              toast.error("Nicht wiederhergestellt", { description: result.error, duration: 5000 });
              return;
            }
            toast.success(`Version ${version} wiederhergestellt`, { duration: 3000 });
            router.push(`/mitglieder/rezepte/${recipeId}`);
          });
        }}
      />
    </>
  );
}
