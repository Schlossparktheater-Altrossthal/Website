"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { ResponsivePanel } from "@/components/ui/responsive-panel";

import {
  applyPlanTemplateAction,
  deletePlanTemplateAction,
  savePlanTemplateAction,
} from "../actions/plan-templates";

export type PlanTemplateSummary = { id: string; name: string; count: number; builtIn: boolean };

/** Vorlage übernehmen (leerer Plan) oder den aktuellen Plan als Vorlage speichern. */
export function TemplatesPanel({
  mode,
  open,
  onOpenChange,
  showId,
  defaultName,
  templates,
}: {
  mode: "apply" | "save";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showId: string;
  defaultName: string;
  templates: PlanTemplateSummary[];
}) {
  const [name, setName] = React.useState(defaultName);
  const [pending, startTransition] = React.useTransition();

  const run = (action: () => ReturnType<typeof applyPlanTemplateAction>, close = true) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) toast.success(result.message);
        if (close) onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "apply" ? "Vorlage übernehmen" : "Als Vorlage speichern"}
      description={mode === "apply" ? "Vorlage für den Plan wählen" : "Name der Vorlage"}
    >
      {mode === "apply" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Abstände bleiben, die Daten rechnen sich aus Premiere und Endprobenwoche.
          </p>
          <ListRowGroup variant="inset">
            {templates.map((template) => (
              <ListRow
                key={template.id}
                onClick={
                  pending
                    ? undefined
                    : () => run(() => applyPlanTemplateAction(showId, template.id))
                }
                title={template.name}
                description={`${template.count} Meilensteine${template.builtIn ? " · Schätzwerte" : ""}`}
              />
            ))}
          </ListRowGroup>
          {templates.some((template) => !template.builtIn) ? (
            <div className="flex flex-wrap gap-2">
              {templates
                .filter((template) => !template.builtIn)
                .map((template) => (
                  <Button
                    key={template.id}
                    size="xs"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => run(() => deletePlanTemplateAction(template.id), false)}
                  >
                    „{template.name}“ löschen
                  </Button>
                ))}
            </div>
          ) : null}
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => savePlanTemplateAction(showId, name));
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !name.trim()}>
              Speichern
            </Button>
          </div>
        </form>
      )}
    </ResponsivePanel>
  );
}
