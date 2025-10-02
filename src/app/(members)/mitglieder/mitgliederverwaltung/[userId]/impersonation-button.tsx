"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startImpersonationAction } from "./actions";

type ImpersonationButtonProps = {
  targetUserId: string;
  targetName: string;
  redirectTo?: string | null;
  disabled?: boolean;
};

export function ImpersonationButton({
  targetUserId,
  targetName,
  redirectTo,
  disabled = false,
}: ImpersonationButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentLocation = useMemo(() => {
    const basePath = pathname || "/";
    const search = searchParams?.toString() ?? "";
    return search ? `${basePath}?${search}` : basePath;
  }, [pathname, searchParams]);

  const redirectTarget = useMemo(() => {
    if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
      return redirectTo;
    }
    return currentLocation;
  }, [currentLocation, redirectTo]);

  const handleClick = () => {
    startTransition(async () => {
      const result = await startImpersonationAction({
        targetUserId,
        redirectTo: redirectTarget,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Aktion konnte nicht ausgeführt werden.");
        return;
      }
      toast.success(`Ansicht als ${targetName} aktiviert.`);
      if (result.redirectTo && result.redirectTo !== currentLocation) {
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
