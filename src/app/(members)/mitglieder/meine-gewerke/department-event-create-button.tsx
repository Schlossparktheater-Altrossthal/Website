"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createDepartmentEventAction } from "./department-events-actions";

type DefaultValues = Partial<{
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
}>;

type TriggerProps = {
  label?: string;
  icon?: LucideIcon;
  className?: string;
} & Pick<ButtonProps, "size" | "variant">;

type CreateDepartmentEventButtonProps = {
  departmentId: string;
  departmentSlug: string;
  defaultValues?: DefaultValues;
  triggerProps?: TriggerProps;
  dialogDescription?: string;
};

export function CreateDepartmentEventButton({
  departmentId,
  departmentSlug,
  defaultValues,
  triggerProps,
  dialogDescription = "Lege Titel, Zeitpunkt und optional Ort oder Notizen fest. Der Termin erscheint sofort im Kalender deines Gewerks.",
}: CreateDepartmentEventButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const resolvedDefaults = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      title: defaultValues?.title ?? "",
      date: defaultValues?.date ?? today,
      startTime: defaultValues?.startTime ?? "18:00",
      endTime: defaultValues?.endTime ?? "20:00",
      location: defaultValues?.location ?? "",
      description: defaultValues?.description ?? "",
    };
  }, [defaultValues]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(() => {
      createDepartmentEventAction({
        departmentId,
        departmentSlug,
        title: String(formData.get("title") ?? ""),
        date: String(formData.get("date") ?? ""),
        startTime: String(formData.get("startTime") ?? ""),
        endTime: (formData.get("endTime") as string | null) ?? undefined,
        location: (formData.get("location") as string | null) ?? undefined,
        description: (formData.get("description") as string | null) ?? undefined,
      })
        .then((result) => {
          if (result?.success) {
            toast.success("Termin gespeichert.");
            form.reset();
            setOpen(false);
            router.refresh();
          } else {
            toast.error(result?.error ?? "Termin konnte nicht angelegt werden.");
          }
        })
        .catch(() => {
          toast.error("Termin konnte nicht angelegt werden.");
        });
    });
  };

  const {
    label: triggerLabel = "Termin planen",
    icon: TriggerIcon = CalendarPlus,
    variant: triggerVariant = "secondary",
    size: triggerSize = "sm",
    className: triggerClassName,
  } = triggerProps ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={triggerSize}
          variant={triggerVariant}
          className={cn(
            "gap-2 rounded-full bg-gradient-to-r from-primary via-primary/90 to-primary text-primary-foreground shadow-[0_16px_40px_-32px_rgba(99,102,241,0.85)] transition hover:from-primary/90 hover:via-primary/80 hover:to-primary/90",
            triggerClassName,
          )}
        >
          <TriggerIcon aria-hidden className="h-4 w-4" />
          <span>{triggerLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuen Termin planen</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="department-event-title">Titel</Label>
            <Input
              id="department-event-title"
              name="title"
              placeholder="z. B. Licht-Setup abstimmen"
              required
              minLength={3}
              maxLength={120}
              defaultValue={resolvedDefaults.title}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department-event-date">Datum</Label>
              <Input
                id="department-event-date"
                name="date"
                type="date"
                required
                defaultValue={resolvedDefaults.date}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department-event-start">Start</Label>
              <Input
                id="department-event-start"
                name="startTime"
                type="time"
                required
                defaultValue={resolvedDefaults.startTime}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department-event-end">Ende (optional)</Label>
              <Input
                id="department-event-end"
                name="endTime"
                type="time"
                defaultValue={resolvedDefaults.endTime}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department-event-location">Ort (optional)</Label>
              <Input
                id="department-event-location"
                name="location"
                placeholder="z. B. Werkstatt oder Lager"
                maxLength={120}
                defaultValue={resolvedDefaults.location}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="department-event-description">Notizen (optional)</Label>
            <Textarea
              id="department-event-description"
              name="description"
              placeholder="Checkliste, Verantwortlichkeiten oder besondere Hinweise"
              rows={4}
              maxLength={2000}
              defaultValue={resolvedDefaults.description}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Speichern…" : "Termin anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

