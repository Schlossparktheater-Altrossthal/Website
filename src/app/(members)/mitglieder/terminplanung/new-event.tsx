"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarEventKind } from "@prisma/client";
import { toast } from "sonner";

import { CalendarPlusIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AudienceInput } from "@/lib/calendar/audience-server";
import { cn } from "@/lib/utils";

import { createRehearsalDraftAction } from "./actions/drafts";

/** Legt einen Entwurf an und öffnet den Editor. */
export function useCreateDraft() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const create = (
    kind: CalendarEventKind,
    date: string,
    options?: { title?: string; audience?: AudienceInput },
  ) =>
    startTransition(async () => {
      const result = await createRehearsalDraftAction({
        kind,
        date,
        time: "19:00",
        ...options,
      }).catch(() => null);
      if (result && "success" in result && result.id) {
        router.push(`/mitglieder/terminplanung/${result.id}`);
      } else {
        toast.error(
          (result && "error" in result ? result.error : null) ??
            "Der Entwurf konnte nicht angelegt werden.",
        );
      }
    });
  return { create, pending };
}

/** „Neu“ in der Werkzeugleiste: Probe oder anderer Termin am gewählten Tag. */
export function NewEventButton({
  date,
  label = "Neu",
  className,
}: {
  date: string;
  label?: string;
  className?: string;
}) {
  const { create, pending } = useCreateDraft();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" className={cn("h-10", className)} disabled={pending}>
          <CalendarPlusIcon className="h-4 w-4" aria-hidden />
          {pending ? "Legt an …" : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => create("REHEARSAL", date)}>Probe</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => create("MEETING", date)}>Anderer Termin</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Große Knöpfe im Tagesblatt – mit dem Daumen gut erreichbar. */
export function NewEventButtons({ date }: { date: string }) {
  const { create, pending } = useCreateDraft();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        className="h-11"
        disabled={pending}
        onClick={() => create("REHEARSAL", date)}
      >
        <CalendarPlusIcon className="h-4 w-4" aria-hidden />
        Probe
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        disabled={pending}
        onClick={() => create("MEETING", date)}
      >
        <CalendarPlusIcon className="h-4 w-4" aria-hidden />
        Termin
      </Button>
    </div>
  );
}
