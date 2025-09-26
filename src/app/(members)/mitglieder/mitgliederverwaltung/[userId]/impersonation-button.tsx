"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startImpersonationAction } from "./actions";

type ImpersonationButtonProps = {
  targetUserId: string;
  targetName: string;
  redirectTo?: string;
  disabled?: boolean;
};

export function ImpersonationButton({
  targetUserId,
  targetName,
  redirectTo = "/",
  disabled = false,
}: ImpersonationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await startImpersonationAction({
        targetUserId,
        redirectTo,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Aktion konnte nicht ausgeführt werden.");
        return;
      }
      toast.success(`Ansicht als ${targetName} aktiviert.`);
      if (result.redirectTo) {
        router.push(result.redirectTo);
      }
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={disabled || isPending}
      className="gap-2"
    >
      {isPending ? "Aktiviere Ansicht..." : `Als ${targetName} ansehen`}
    </Button>
  );
}
