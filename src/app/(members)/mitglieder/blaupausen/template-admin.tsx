"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DEFAULT_DEPARTMENT_MODULES } from "@/lib/departments/modules";
import type { TemplateAdminEntry, TemplatePermissionGroup } from "@/lib/departments/template-admin";
import {
  TEMPLATE_ICONS,
  resolveTemplateIcon,
  type TemplateIconKey,
} from "@/lib/departments/template-icons";
import { getRolePreferenceTitle } from "@/lib/onboarding/role-preferences";
import { cn } from "@/lib/utils";

import { ColorPicker, ModuleSwitches } from "../meine-gewerke/create-department-panel";
import {
  saveTemplateAction,
  setTemplateArchivedAction,
  setTemplatePermissionAction,
} from "./actions";

type Role = keyof TemplateAdminEntry["grants"];
type Section = "general" | "modules" | "permissions" | "onboarding";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "lead", label: "Leitung" },
  { value: "deputy", label: "Vertretung" },
  { value: "member", label: "Mitglied" },
  { value: "guest", label: "Gast" },
];

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

const NEW_ID = "__new__";

function emptyTemplate(): TemplateAdminEntry {
  return {
    id: NEW_ID,
    slug: "",
    name: "",
    description: null,
    color: null,
    icon: null,
    modules: [...DEFAULT_DEPARTMENT_MODULES],
    requiresJoinApproval: true,
    onboardingVisible: true,
    onboardingDescription: null,
    preferenceCodes: [],
    archived: false,
    departments: [],
    grants: { lead: [], deputy: [], member: [], guest: [] },
  };
}

export function TemplateAdmin({
  templates,
  permissionGroups,
}: {
  templates: TemplateAdminEntry[];
  permissionGroups: TemplatePermissionGroup[];
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<TemplateAdminEntry | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);

  const active = templates.filter((template) => !template.archived);
  const archived = templates.filter((template) => template.archived);
  const desktopSelectedId = selectedId ?? active[0]?.id ?? null;
  const currentId = isDesktop ? desktopSelectedId : selectedId;
  const current = draft ?? templates.find((template) => template.id === currentId) ?? null;

  const select = (id: string) => {
    setDraft(null);
    setSelectedId(id);
  };
  const startNew = () => {
    setSelectedId(NEW_ID);
    setDraft(emptyTemplate());
  };
  const close = () => {
    setSelectedId(null);
    setDraft(null);
  };
  const onCreated = (id: string) => {
    setDraft(null);
    setSelectedId(id);
  };

  const list = (
    <div className="space-y-3">
      <Button type="button" className="h-11 w-full" onClick={startNew}>
        <PlusIcon className="mr-1 h-4 w-4" aria-hidden />
        Neue Blaupause
      </Button>
      <TemplateList templates={active} selectedId={currentId} onSelect={select} />
      {archived.length ? (
        <div className="space-y-2">
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setShowArchived((value) => !value)}
            aria-expanded={showArchived}
          >
            {showArchived ? "Archivierte ausblenden" : `Archivierte zeigen (${archived.length})`}
          </button>
          {showArchived ? (
            <TemplateList templates={archived} selectedId={currentId} onSelect={select} />
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (isDesktop) {
    return (
      <div className="grid grid-cols-[minmax(260px,320px)_1fr] items-start gap-6">
        {list}
        <div className="rounded-2xl border border-border bg-card p-5">
          {current ? (
            <TemplateEditor
              key={current.id}
              template={current}
              permissionGroups={permissionGroups}
              onCreated={onCreated}
            />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Wähle links eine Blaupause.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {list}
      {current ? (
        <TemplateEditor
          key={current.id}
          template={current}
          permissionGroups={permissionGroups}
          onCreated={onCreated}
          sheet={{ open: true, onClose: close }}
        />
      ) : null}
    </>
  );
}

function TemplateList({
  templates,
  selectedId,
  onSelect,
}: {
  templates: TemplateAdminEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {templates.map((template) => {
        const { Icon } = resolveTemplateIcon(template.icon, template.slug);
        const selected = template.id === selectedId;
        return (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => onSelect(template.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40",
                selected && "bg-muted/60",
              )}
            >
              <TemplateBadge color={template.color} Icon={Icon} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{template.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {template.departments.length
                    ? `${template.departments.length} ${template.departments.length === 1 ? "Gewerk" : "Gewerke"}`
                    : "Nicht in Gebrauch"}
                  {template.onboardingVisible ? " · im Onboarding" : ""}
                </span>
              </span>
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TemplateBadge({
  color,
  Icon,
}: {
  color: string | null;
  Icon: (props: { className?: string; "aria-hidden"?: boolean }) => React.ReactNode;
}) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

function TemplateEditor({
  template,
  permissionGroups,
  onCreated,
  sheet,
}: {
  template: TemplateAdminEntry;
  permissionGroups: TemplatePermissionGroup[];
  onCreated: (id: string) => void;
  sheet?: { open: boolean; onClose: () => void };
}) {
  const router = useRouter();
  const isNew = template.id === NEW_ID;
  const [section, setSection] = React.useState<Section>("general");
  const [form, setForm] = React.useState(template);
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(template);

  const update = <K extends keyof TemplateAdminEntry>(key: K, value: TemplateAdminEntry[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const save = async () => {
    setSaving(true);
    const result = await saveTemplateAction({
      id: isNew ? undefined : template.id,
      name: form.name,
      description: form.description,
      color: form.color,
      icon: form.icon,
      modules: form.modules,
      requiresJoinApproval: form.requiresJoinApproval,
      onboardingVisible: form.onboardingVisible,
      onboardingDescription: form.onboardingDescription,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    toast.success(isNew ? "Blaupause angelegt" : "Gespeichert", { duration: 3000 });
    if (isNew && "id" in result && result.id) onCreated(result.id);
    router.refresh();
  };

  const toggleArchived = async () => {
    const result = await setTemplateArchivedAction({
      id: template.id,
      archived: !template.archived,
    });
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    toast.success(template.archived ? "Wiederhergestellt" : "Archiviert", { duration: 3000 });
    router.refresh();
  };

  const sections: { value: Section; label: string; disabled?: boolean }[] = [
    { value: "general", label: "Allgemein" },
    { value: "modules", label: "Bausteine" },
    { value: "permissions", label: "Rechte", disabled: isNew },
    { value: "onboarding", label: "Onboarding" },
  ];

  const body = (
    <div className="space-y-5">
      <SegmentedControl
        aria-label="Bereich"
        value={section}
        onValueChange={setSection}
        fullWidth
        options={sections}
      />
      {section === "general" ? (
        <GeneralSection form={form} update={update} />
      ) : section === "modules" ? (
        <div className="space-y-2">
          <ModuleSwitches value={form.modules} onChange={(modules) => update("modules", modules)} />
          <p className="text-xs text-muted-foreground">
            Das Portal jedes Gewerks zeigt genau diese Bereiche.
          </p>
        </div>
      ) : section === "permissions" ? (
        <PermissionsSection template={template} permissionGroups={permissionGroups} />
      ) : (
        <OnboardingSection form={form} update={update} />
      )}
    </div>
  );

  const footer =
    section === "permissions" ? null : (
      <div className="flex gap-2">
        {isNew ? null : (
          <Button type="button" variant="outline" className="h-11" onClick={toggleArchived}>
            {template.archived ? (
              <ArchiveRestoreIcon className="mr-1 h-4 w-4" aria-hidden />
            ) : (
              <ArchiveIcon className="mr-1 h-4 w-4" aria-hidden />
            )}
            {template.archived ? "Wiederherstellen" : "Archivieren"}
          </Button>
        )}
        <AsyncButton
          type="button"
          className="h-11 flex-1"
          isLoading={saving}
          loadingText="Speichert …"
          disabled={form.name.trim().length < 2 || (!isNew && !dirty)}
          onClick={save}
        >
          {isNew ? "Anlegen" : "Speichern"}
        </AsyncButton>
      </div>
    );

  const title = isNew ? "Neue Blaupause" : template.name;

  if (sheet) {
    return (
      <ResponsivePanel
        open={sheet.open}
        onOpenChange={(open) => (open ? null : sheet.onClose())}
        title={title}
        description="Blaupause bearbeiten"
        footer={footer}
      >
        {body}
      </ResponsivePanel>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {template.departments.length ? (
            <p className="text-xs text-muted-foreground">
              Genutzt von:{" "}
              {template.departments
                .map((department) => `${department.name} (${department.production})`)
                .join(", ")}
            </p>
          ) : null}
        </div>
        {template.archived ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Archiviert
          </span>
        ) : null}
      </div>
      {body}
      {footer}
    </div>
  );
}

type UpdateFn = <K extends keyof TemplateAdminEntry>(key: K, value: TemplateAdminEntry[K]) => void;

function GeneralSection({ form, update }: { form: TemplateAdminEntry; update: UpdateFn }) {
  const currentIcon = resolveTemplateIcon(form.icon, form.slug).key;
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Name</span>
        <input
          className={inputClass}
          value={form.name}
          maxLength={80}
          placeholder="z. B. Pyrotechnik"
          onChange={(event) => update("name", event.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Beschreibung</span>
        <textarea
          className={cn(inputClass, "h-auto min-h-20 py-2")}
          value={form.description ?? ""}
          maxLength={2000}
          placeholder="Worum kümmert sich das Gewerk?"
          onChange={(event) => update("description", event.target.value)}
        />
      </label>
      <ColorPicker value={form.color} onChange={(color) => update("color", color)} />
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Symbol</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Symbol">
          {(Object.keys(TEMPLATE_ICONS) as TemplateIconKey[]).map((key) => {
            const { Icon, label } = TEMPLATE_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={currentIcon === key}
                aria-label={label}
                title={label}
                onClick={() => update("icon", key)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border border-border",
                  currentIcon === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">Beitritt mit Prüfung</span>
          <span className="block text-xs text-muted-foreground">
            Standard für neue Gewerke dieser Blaupause.
          </span>
        </span>
        <Switch
          checked={form.requiresJoinApproval}
          onCheckedChange={(value) => update("requiresJoinApproval", value)}
        />
      </label>
    </div>
  );
}

function OnboardingSection({ form, update }: { form: TemplateAdminEntry; update: UpdateFn }) {
  return (
    <div className="space-y-4">
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">Im Onboarding anbieten</span>
          <span className="block text-xs text-muted-foreground">
            Neue und zurückkehrende Mitglieder können sich dieses Gewerk wünschen, wenn es in der
            Produktion angelegt ist.
          </span>
        </span>
        <Switch
          checked={form.onboardingVisible}
          onCheckedChange={(value) => update("onboardingVisible", value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Text im Onboarding</span>
        <textarea
          className={cn(inputClass, "h-auto min-h-20 py-2")}
          value={form.onboardingDescription ?? ""}
          maxLength={300}
          disabled={!form.onboardingVisible}
          placeholder={form.description ?? "Was macht man hier, wie viel Zeit braucht es?"}
          onChange={(event) => update("onboardingDescription", event.target.value)}
        />
        <span className="block text-xs text-muted-foreground">
          Leer lassen, um die Beschreibung zu verwenden.
        </span>
      </label>
      {form.preferenceCodes.length ? (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Frühere Wünsche, die hierzu zählen
          </span>
          <div className="flex flex-wrap gap-1.5">
            {form.preferenceCodes.map((code) => (
              <span key={code} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                {getRolePreferenceTitle(code)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PermissionsSection({
  template,
  permissionGroups,
}: {
  template: TemplateAdminEntry;
  permissionGroups: TemplatePermissionGroup[];
}) {
  const router = useRouter();
  const [role, setRole] = React.useState<Role>("lead");
  const [grants, setGrants] = React.useState(template.grants);
  const [query, setQuery] = React.useState("");
  const [onlyGranted, setOnlyGranted] = React.useState(false);
  const granted = new Set(grants[role]);

  const toggle = async (key: string, next: boolean) => {
    const previous = grants;
    setGrants((current) => ({
      ...current,
      [role]: next ? [...current[role], key] : current[role].filter((entry) => entry !== key),
    }));
    const result = await setTemplatePermissionAction({
      templateId: template.id,
      permissionKey: key,
      role,
      granted: next,
    });
    if (!result.ok) {
      setGrants(previous);
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    router.refresh();
  };

  const needle = query.trim().toLowerCase();
  const groups = permissionGroups
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter(
        (permission) =>
          (!onlyGranted || granted.has(permission.key)) &&
          (!needle ||
            permission.label.toLowerCase().includes(needle) ||
            permission.description?.toLowerCase().includes(needle)),
      ),
    }))
    .filter((group) => group.permissions.length);

  return (
    <div className="space-y-4">
      <SegmentedControl
        aria-label="Rolle im Gewerk"
        value={role}
        onValueChange={setRole}
        fullWidth
        options={ROLE_OPTIONS.map((option) => ({
          value: option.value,
          label: `${option.label}${grants[option.value].length ? ` · ${grants[option.value].length}` : ""}`,
          ariaLabel: option.label,
        }))}
      />
      <p className="text-xs text-muted-foreground">
        Gilt sofort für alle Gewerke dieser Blaupause. Abweichungen einzelner Gewerke bleiben
        erhalten.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          className={cn(inputClass, "min-w-0 flex-1")}
          value={query}
          placeholder="Recht suchen …"
          aria-label="Recht suchen"
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Switch checked={onlyGranted} onCheckedChange={setOnlyGranted} />
          Nur vergebene
        </label>
      </div>
      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Keine passenden Rechte.</p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h3>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {group.permissions.map((permission) => (
                <li key={permission.key}>
                  <label className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{permission.label}</span>
                      {permission.description ? (
                        <span className="line-clamp-2 block text-xs text-muted-foreground">
                          {permission.description}
                        </span>
                      ) : null}
                    </span>
                    <Switch
                      checked={granted.has(permission.key)}
                      onCheckedChange={(next) => toggle(permission.key, next)}
                      aria-label={`${permission.label} für ${ROLE_OPTIONS.find((o) => o.value === role)?.label}`}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
