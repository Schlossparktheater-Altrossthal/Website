"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

import type { ImpersonationDetails } from "@/lib/auth/impersonation";
import { Button } from "@/components/ui/button";
import { stopImpersonationAction } from "./actions";

const startedAtFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatStartedAt(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return startedAtFormatter.format(parsed);
}

type ImpersonationBannerProps = {
  details: ImpersonationDetails;
};

export function ImpersonationBanner({ details }: ImpersonationBannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const redirectTarget = useMemo(() => {
    const basePath = pathname || "/";
    const search = searchParams?.toString() ?? "";
    return search ? `${basePath}?${search}` : basePath;
  }, [pathname, searchParams]);

  const startedAtLabel = useMemo(
    () => formatStartedAt(details.startedAt),
    [details.startedAt],
  );

  const targetName = details.target.name ?? "dieses Mitglied";
  const ownerName = details.owner.name ?? "dir selbst";

  const handleReset = () => {
    startTransition(async () => {
      const result = await stopImpersonationAction({ redirectTo: redirectTarget });
      if (!result.ok) {
        toast.error(result.error ?? "Impersonation konnte nicht beendet werden.");
        return;
      }
      if (result.redirectTo) {
        router.push(result.redirectTo);
      }
      router.refresh();
      toast.success("Eigene Ansicht wiederhergestellt.");
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-4 text-warning-foreground shadow-sm ring-1 ring-warning/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-warning/40 bg-warning/20">
          <UserRoundCheck className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-semibold leading-tight">
            Du siehst diese Seite gerade als <span className="underline decoration-warning/60 decoration-2 underline-offset-4">{targetName}</span>.
          </p>
          <p className="text-warning-foreground/80">
            Ursprünglich angemeldet als {ownerName}
            {startedAtLabel ? ` · aktiviert ${startedAtLabel}` : ""}.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-warning/40 bg-background/70 text-warning hover:bg-warning/20 hover:text-warning-foreground"
          onClick={handleReset}
          disabled={isPending}
        >
          {isPending ? "Stelle Ansicht wieder her..." : "Zurück zu deiner Ansicht"}
        </Button>
      </div>
    </div>
  );
}
