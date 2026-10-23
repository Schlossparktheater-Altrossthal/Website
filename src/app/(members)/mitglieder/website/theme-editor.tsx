"use client";

import * as React from "react";

import { ChevronDownIcon, CopyIcon, LockIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import type { ThemeColorScheme, TweakcnTheme } from "@/lib/theme/tweakcn";

import { ThemeColorField } from "./theme-color-field";
import { ThemeLivePreview } from "./theme-live-preview";
import { KEY_COLOR_VARIABLES, groupVariables } from "./theme-utils";

const SCHEME_OPTIONS: { value: ThemeColorScheme; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

const TYPE_FIELDS: { name: string; label: string; placeholder: string }[] = [
  { name: "font-sans", label: "Schrift (sans)", placeholder: '"Outfit", sans-serif' },
  { name: "font-serif", label: "Schrift (serif)", placeholder: '"Playfair Display", serif' },
  { name: "font-mono", label: "Schrift (mono)", placeholder: '"Fira Mono", monospace' },
  { name: "tracking-normal", label: "Laufweite", placeholder: "0em" },
];

function EditorSection({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border border-border/60">
      <CollapsibleTrigger className="group flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="border-t border-border/60 p-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const COLOR_GRID = "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3";

export type ThemeEditorProps = {
  draft: TweakcnTheme;
  onDraftChange: (updater: (prev: TweakcnTheme) => TweakcnTheme) => void;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  locked: boolean;
  onDuplicate: () => void;
  scheme: ThemeColorScheme;
  onSchemeChange: (scheme: ThemeColorScheme) => void;
};

/** Theme bearbeiten: wichtigste Farben zuerst, der Rest aufklappbar, Vorschau daneben. */
export function ThemeEditor({
  draft,
  onDraftChange,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  locked,
  onDuplicate,
  scheme,
  onSchemeChange,
}: ThemeEditorProps) {
  const schemeVars = draft[scheme];
  const groups = React.useMemo(() => groupVariables(schemeVars), [schemeVars]);

  const setThemeVar = (variable: string, value: string) =>
    onDraftChange((prev) => ({ ...prev, theme: { ...prev.theme, [variable]: value } }));
  const setSchemeVar = (variable: string, value: string) =>
    onDraftChange((prev) => ({ ...prev, [scheme]: { ...prev[scheme], [variable]: value } }));

  const colorField = (variable: string) =>
    variable.startsWith("shadow") ? (
      <div key={variable} className="space-y-1">
        <Label htmlFor={`shadow-${variable}`} className="font-mono text-xs">
          --{variable}
        </Label>
        <Input
          id={`shadow-${variable}`}
          value={schemeVars[variable] ?? ""}
          maxLength={400}
          disabled={locked}
          onChange={(event) => setSchemeVar(variable, event.target.value)}
          className="font-mono text-xs"
        />
      </div>
    ) : (
      <ThemeColorField
        key={variable}
        name={variable}
        value={schemeVars[variable] ?? ""}
        disabled={locked}
        onChange={(value) => setSchemeVar(variable, value)}
      />
    );

  const schemeLabel = scheme === "dark" ? "dunkel" : "hell";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-3 lg:sticky lg:top-20 lg:order-2 lg:self-start">
        <SegmentedControl
          aria-label="Farbmodus bearbeiten"
          size="md"
          fullWidth
          value={scheme}
          onValueChange={onSchemeChange}
          options={SCHEME_OPTIONS}
        />
        <ThemeLivePreview theme={draft} scheme={scheme} />
        <p className="text-xs text-muted-foreground">
          Vorschau und Farbfelder zeigen den Modus „{schemeLabel}“.
        </p>
      </div>

      <div className="min-w-0 space-y-3 lg:order-1">
        {locked ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted p-3">
            <LockIcon className="size-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              Vorlagen sind schreibgeschützt. Lege eine Kopie an, um sie anzupassen.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
              <CopyIcon />
              Kopie bearbeiten
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="theme-name">Name</Label>
              <Input
                id="theme-name"
                value={name}
                maxLength={120}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="theme-description">Beschreibung</Label>
              <Textarea
                id="theme-description"
                value={description}
                maxLength={500}
                rows={1}
                className="min-h-10"
                onChange={(event) => onDescriptionChange(event.target.value)}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Wichtigste Farben</h3>
          <div className={COLOR_GRID}>{KEY_COLOR_VARIABLES.map(colorField)}</div>
        </div>

        <EditorSection
          title="Schrift & Form"
          hint="Gilt für hell und dunkel. Verfügbar: Geist, Outfit, Inter, Playfair Display, Fira Mono."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="theme-radius">Ecken-Radius</Label>
              <Input
                id="theme-radius"
                value={draft.theme.radius ?? ""}
                placeholder="0.5rem"
                disabled={locked}
                onChange={(event) => setThemeVar("radius", event.target.value)}
                className="font-mono text-xs"
              />
            </div>
            {TYPE_FIELDS.map((field) => (
              <div key={field.name} className="space-y-1">
                <Label htmlFor={`theme-${field.name}`}>{field.label}</Label>
                <Input
                  id={`theme-${field.name}`}
                  value={draft.theme[field.name] ?? ""}
                  placeholder={field.placeholder}
                  disabled={locked}
                  onChange={(event) => setThemeVar(field.name, event.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            ))}
          </div>
        </EditorSection>

        {groups.map((group) => (
          <EditorSection
            key={group.id}
            title={group.label}
            hint={`${group.names.length} Werte · ${schemeLabel}`}
          >
            <div className={COLOR_GRID}>{group.names.map(colorField)}</div>
          </EditorSection>
        ))}
      </div>
    </div>
  );
}
