"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import type { ProductionActionResult } from "@/lib/produktionen/actions-helpers";

import {
  saveOnboardingLinkAction,
  switchProductionAction,
  updateProductionTimelineAction,
} from "../actions/production";

function useSubmit(action: (formData: FormData) => Promise<ProductionActionResult>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submit = (formData: FormData, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Gespeichert.");
      onSuccess?.();
      router.refresh();
    });
  return { submit, isPending };
}

/** Premiere und Endprobenwoche – Fristen im Plan hängen daran und werden mitverschoben. */
export function TimelineForm({
  showId,
  premiere,
  weekStart,
  weekEnd,
}: {
  showId: string;
  premiere: string;
  weekStart: string;
  weekEnd: string;
}) {
  const pathname = usePathname();
  const { submit, isPending } = useSubmit(updateProductionTimelineAction);
  return (
    <form
      action={(formData) => submit(formData)}
      className="grid gap-3 sm:grid-cols-3 sm:items-end"
    >
      <input type="hidden" name="showId" value={showId} />
      <input type="hidden" name="redirectPath" value={pathname} />
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="premiereAt">
          Premiere
        </label>
        <DateInput id="premiereAt" name="premiereAt" defaultValue={premiere} />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="finalRehearsalWeekStart">
          Endprobenwoche ab
        </label>
        <DateInput
          id="finalRehearsalWeekStart"
          name="finalRehearsalWeekStart"
          defaultValue={weekStart}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="finalRehearsalWeekEnd">
          bis
        </label>
        <DateInput id="finalRehearsalWeekEnd" name="finalRehearsalWeekEnd" defaultValue={weekEnd} />
      </div>
      <div className="sm:col-span-3 sm:flex sm:justify-end">
        <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
          Termine speichern
        </Button>
      </div>
    </form>
  );
}

/** WhatsApp-Beitrittslink, den neue Mitglieder am Ende des Onboardings sehen. */
export function OnboardingLinkForm({ showId, link }: { showId: string; link: string | null }) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(link ?? "");
  const { submit, isPending } = useSubmit(saveOnboardingLinkAction);
  return (
    <form ref={formRef} action={(formData) => submit(formData)} className="space-y-3">
      <input type="hidden" name="showId" value={showId} />
      <input type="hidden" name="redirectPath" value={pathname} />
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="whatsappLink">
          WhatsApp-Beitrittslink
        </label>
        <Input
          id="whatsappLink"
          name="whatsappLink"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://chat.whatsapp.com/…"
          inputMode="url"
        />
        <p className="text-xs text-muted-foreground">
          Neue Mitglieder sehen ihn am Ende des Onboardings.
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {link ? (
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            className="text-destructive hover:text-destructive"
            onClick={() => {
              const formData = new FormData();
              formData.set("showId", showId);
              formData.set("redirectPath", pathname);
              formData.set("clear", "1");
              submit(formData, () => setValue(""));
            }}
          >
            Link entfernen
          </Button>
        ) : null}
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={isPending || value.trim() === (link ?? "")}
        >
          Speichern
        </Button>
      </div>
    </form>
  );
}

/** Seiten wie Stück oder Gewerke zeigen immer die angezeigte Produktion – vorher umschalten. */
export function ShowProductionButton({
  showId,
  target,
  children,
}: {
  showId: string;
  target?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await switchProductionAction(showId, pathname);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          if (target) router.push(target);
          router.refresh();
        })
      }
    >
      {children}
    </Button>
  );
}
