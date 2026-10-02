"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CheckIcon, ChevronRightIcon, PlusIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { ROLE_COLOR_OPTIONS } from "@/config/category-colors";
import {
  DEFAULT_DEPARTMENT_MODULES,
  DEPARTMENT_MODULES,
  type DepartmentModuleKey,
} from "@/lib/departments/modules";
import { resolveTemplateIcon } from "@/lib/departments/template-icons";
import type { TemplateChoice } from "@/lib/departments/templates";
import { cn } from "@/lib/utils";

import {
  createDepartmentFromTemplateAction,
  createDepartmentWithNewTemplateAction,
  listTemplateChoicesAction,
} from "../produktionen/actions/department-settings";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

type Mode = "template" | "new";

/** „+ Gewerk anlegen“: aus einer Blaupause oder mit neuer Blaupause (E7) – nur Regie/Board. */
export function CreateDepartmentPanel({
  showId,
  stayOnPage = false,
}: {
  showId: string;
  stayOnPage?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("template");
  const [templates, setTemplates] = React.useState<TemplateChoice[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState<string>(ROLE_COLOR_OPTIONS[0]);
  const [modules, setModules] = React.useState<DepartmentModuleKey[]>(DEFAULT_DEPARTMENT_MODULES);
  const [approval, setApproval] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const openPanel = async () => {
    setOpen(true);
    setSelected(null);
    setLoadError(null);
    const result = await listTemplateChoicesAction({ showId });
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    const list = result.templates ?? [];
    setTemplates(list);
    // Ist alles schon da, gleich zur neuen Blaupause.
    setMode(list.some((template) => !template.inShow) ? "template" : "new");
  };

  const finish = (result: { ok: boolean; error?: string; message?: string; slug?: string }) => {
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    toast.success(result.message ?? "Gewerk angelegt", { duration: 3000 });
    setOpen(false);
    setName("");
    setDescription("");
    setModules(DEFAULT_DEPARTMENT_MODULES);
    if (!stayOnPage && result.slug) {
      router.push(`/mitglieder/meine-gewerke/${encodeURIComponent(result.slug)}`);
    } else {
      router.refresh();
    }
  };

  const create = async () => {
    setSaving(true);
    const result =
      mode === "template"
        ? await createDepartmentFromTemplateAction({ showId, templateId: selected ?? "" })
        : await createDepartmentWithNewTemplateAction({
            showId,
            name,
            description,
            color,
            modules,
            requiresJoinApproval: approval,
          });
    setSaving(false);
    finish(result);
  };

  const available = templates?.filter((template) => !template.inShow) ?? [];
  const existing = templates?.filter((template) => template.inShow) ?? [];
  const canCreate = mode === "template" ? Boolean(selected) : name.trim().length >= 2;

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border p-3 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      >
        <PlusIcon className="h-5 w-5" aria-hidden />
        Gewerk anlegen
      </button>
      <ResponsivePanel
        open={open}
        onOpenChange={setOpen}
        title="Gewerk anlegen"
        description="Jedes Gewerk entsteht aus einer Blaupause."
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <AsyncButton
              type="button"
              className="h-11 flex-1"
              isLoading={saving}
              loadingText="Legt an …"
              disabled={!canCreate}
              onClick={create}
            >
              {mode === "template" ? "Gewerk anlegen" : "Blaupause + Gewerk anlegen"}
            </AsyncButton>
          </div>
        }
      >
        <div className="space-y-4">
          <SegmentedControl
            aria-label="Art"
            value={mode}
            onValueChange={setMode}
            fullWidth
            size="md"
            options={[
              { value: "template", label: "Aus Blaupause" },
              { value: "new", label: "Neue Blaupause" },
            ]}
          />

          {mode === "template" ? (
            <div className="space-y-3">
              {loadError ? (
                <p role="alert" className="text-sm text-destructive">
                  {loadError}
                </p>
              ) : templates === null ? (
                <p className="text-sm text-muted-foreground">Lädt Blaupausen …</p>
              ) : available.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Alle Blaupausen sind in dieser Produktion schon angelegt.{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline underline-offset-2"
                    onClick={() => setMode("new")}
                  >
                    Neue Blaupause anlegen
                  </button>
                </div>
              ) : (
                <ul className="space-y-2" role="radiogroup" aria-label="Blaupause">
                  {available.map((template) => (
                    <li key={template.id}>
                      <TemplateOption
                        template={template}
                        checked={selected === template.id}
                        onSelect={() => setSelected(template.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {existing.length ? (
                <p className="text-xs text-muted-foreground">
                  Schon in der Produktion: {existing.map((template) => template.name).join(", ")}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Name</span>
                <input
                  className={inputClass}
                  value={name}
                  maxLength={80}
                  autoFocus
                  placeholder="z. B. Pyrotechnik"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Beschreibung</span>
                <textarea
                  className={cn(inputClass, "h-auto min-h-20 py-2")}
                  value={description}
                  maxLength={2000}
                  placeholder="Worum kümmert sich das Gewerk?"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <ColorPicker value={color} onChange={setColor} />
              <ModuleSwitches value={modules} onChange={setModules} />
              <label className="flex min-h-11 items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">Beitritt mit Prüfung</span>
                  <span className="block text-xs text-muted-foreground">
                    Wer beitreten möchte, stellt eine Anfrage; die Leitung entscheidet.
                  </span>
                </span>
                <Switch checked={approval} onCheckedChange={setApproval} />
              </label>
              <p className="text-xs text-muted-foreground">
                Die Blaupause steht danach auch anderen Produktionen zur Verfügung. Rechte und
                Onboarding pflegst du unter „Blaupausen“.
              </p>
            </div>
          )}
        </div>
      </ResponsivePanel>
    </>
  );
}

function TemplateOption({
  template,
  checked,
  onSelect,
}: {
  template: TemplateChoice;
  checked: boolean;
  onSelect: () => void;
}) {
  const { Icon } = resolveTemplateIcon(template.icon, template.slug);
  const moduleLabels = DEPARTMENT_MODULES.filter((module) =>
    template.modules.includes(module.key),
  ).map((module) => module.label);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: template.color ? `${template.color}22` : undefined,
          color: template.color ?? undefined,
        }}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{template.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {moduleLabels.join(" · ") || "Keine Bausteine"}
        </span>
      </span>
      {checked ? (
        <CheckIcon className="h-4 w-4 text-primary" aria-hidden />
      ) : (
        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
    </button>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">Farbe</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
        {ROLE_COLOR_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            aria-label={option}
            onClick={() => onChange(option)}
            className={cn(
              "h-9 w-9 rounded-full ring-offset-2 ring-offset-background",
              value === option ? "ring-2 ring-ring" : "",
            )}
            style={{ backgroundColor: option }}
          />
        ))}
      </div>
    </div>
  );
}

export function ModuleSwitches({
  value,
  onChange,
}: {
  value: DepartmentModuleKey[];
  onChange: (modules: DepartmentModuleKey[]) => void;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-medium text-muted-foreground">Bausteine</legend>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {DEPARTMENT_MODULES.map((module) => {
          const checked = value.includes(module.key);
          return (
            <li key={module.key}>
              <label className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {module.label}
                    {module.ready ? null : (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                        folgt
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">{module.description}</span>
                </span>
                <Switch
                  checked={checked}
                  onCheckedChange={(next) =>
                    onChange(
                      next
                        ? DEPARTMENT_MODULES.map((m) => m.key).filter(
                            (key) => key === module.key || value.includes(key),
                          )
                        : value.filter((key) => key !== module.key),
                    )
                  }
                />
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
