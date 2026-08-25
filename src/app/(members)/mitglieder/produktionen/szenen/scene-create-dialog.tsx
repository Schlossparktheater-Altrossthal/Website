"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createSceneAction } from "../actions";

type Props = {
  showId: string;
  currentPath: string;
};

export function SceneCreateDialog({ showId, currentPath }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Szene erstellen</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neue Szene anlegen</DialogTitle>
          <DialogDescription>
            Erfasse Orte, Zusammenfassungen und Notizen, um den Szenenplan aktuell zu halten.
          </DialogDescription>
        </DialogHeader>
        <form action={createSceneAction} method="post" className="grid gap-6">
          <input type="hidden" name="showId" value={showId} />
          <input type="hidden" name="redirectPath" value={currentPath} />
          <fieldset className="grid gap-3 md:grid-cols-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Basisdaten
            </legend>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nummer</label>
              <Input name="identifier" maxLength={40} placeholder="z.B. 1" required />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Titel</label>
              <Input name="title" maxLength={160} placeholder="z.B. Ankunft im Park" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ort</label>
              <Input name="location" maxLength={120} />
            </div>
          </fieldset>
          <div className="space-y-1">
            <label className="text-sm font-medium">Zusammenfassung</label>
            <Textarea name="summary" rows={2} maxLength={600} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Notizen</label>
            <Textarea name="notes" rows={2} maxLength={400} />
          </div>
          <DialogFooter className="pt-2 sm:justify-end">
            <DialogClose asChild>
              <Button type="submit">Szene speichern</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
