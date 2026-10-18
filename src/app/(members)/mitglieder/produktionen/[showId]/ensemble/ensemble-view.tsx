"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PhotoConsentStatus, ProductionMembershipStatus } from "@prisma/client";
import { toast } from "sonner";

import { CopyIcon, PlusIcon, SearchIcon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ListRow } from "@/components/ui/list-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatTile } from "@/components/ui/stat-tile";
import { PRODUCTION_ROLES, type ProductionRole } from "@/lib/produktionen/production-role-keys";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

import {
  addProductionMemberAction,
  inviteFormerMembersAction,
  removeProductionMemberAction,
  updateProductionMemberAction,
  type InviteFormerMembersResult,
} from "../../actions/ensemble";
import {
  remindMissingPhotoConsentsAction,
  remindOpenOnboardingsAction,
} from "../../actions/reminders";

export type EnsembleMember = {
  id: string;
  userId: string;
  name: string;
  status: ProductionMembershipStatus;
  roles: ProductionRole[];
  func: string | null;
  photoStatus: PhotoConsentStatus | "none";
  onboardingDone: boolean;
  isReturning: boolean;
  deactivated: boolean;
};

export type AddableMember = { id: string; label: string };
export type FormerMember = { id: string; name: string; lastProduction: string; hasEmail: boolean };

type Filter = "all" | "open" | "photo" | "left";

const MEMBERSHIP_STATUS_LABELS: Record<ProductionMembershipStatus, string> = {
  active: "Dabei",
  invited: "Eingeladen",
  onboarding: "Im Onboarding",
  left: "Ausgeschieden",
};

const PHOTO_LABELS: Record<PhotoConsentStatus | "none", string> = {
  none: "Fotoerlaubnis fehlt",
  pending: "Fotoerlaubnis ausstehend",
  approved: "Fotoerlaubnis erteilt",
  rejected: "Fotoerlaubnis abgelehnt",
  noPhotos: "Keine Aufnahmen",
};

const OUTCOME_LABELS = {
  sent: "Mail verschickt",
  "link-only": "Kein Mailversand eingerichtet – Link weitergeben",
  "no-email": "Keine E-Mail-Adresse – Link weitergeben",
  failed: "Mail fehlgeschlagen – Link weitergeben",
} as const;

function isOpen(member: EnsembleMember) {
  return member.status === "invited" || member.status === "onboarding";
}

function needsPhoto(member: EnsembleMember) {
  return member.status === "active" && member.photoStatus !== "approved";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Initials({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground/80",
        muted && "text-muted-foreground",
      )}
    >
      {initials(name)}
    </span>
  );
}

function Hint({ tone, children }: { tone: "warning" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        tone === "warning"
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function describeMember(member: EnsembleMember) {
  const roles = member.roles.map((role) => ROLE_LABELS[role]);
  if (member.func) roles.push(member.func);
  return roles.length > 0 ? roles.join(" · ") : undefined;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function EnsembleView({
  showId,
  members,
  candidates,
  formerMembers,
  remindablePhotoCount,
}: {
  showId: string;
  members: EnsembleMember[];
  candidates: AddableMember[];
  formerMembers: FormerMember[];
  remindablePhotoCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reminder, setReminder] = useState<"onboarding" | "photo" | null>(null);
  const [links, setLinks] = useState<InviteFormerMembersResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const current = members.filter((member) => member.status !== "left");
  const counts = {
    active: members.filter((member) => member.status === "active").length,
    open: members.filter(isOpen).length,
    photo: members.filter(needsPhoto).length,
    left: members.filter((member) => member.status === "left").length,
  };

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return members.filter((member) => {
      if (q && !normalize(member.name).includes(q)) return false;
      if (filter === "open") return isOpen(member);
      if (filter === "photo") return needsPhoto(member);
      if (filter === "left") return member.status === "left";
      return member.status !== "left";
    });
  }, [filter, members, query]);

  const editing = members.find((member) => member.id === editId) ?? null;

  const sendReminder = (kind: "onboarding" | "photo") => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("showId", showId);
      if (kind === "onboarding") {
        const result = await remindOpenOnboardingsAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        setLinks(result);
      } else {
        const result = await remindMissingPhotoConsentsAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Erinnerungen verschickt.");
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile label="Dabei" value={counts.active} tone="success" />
        <StatTile
          label="Im Onboarding"
          value={counts.open}
          tone={counts.open > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Ohne Foto"
          value={counts.photo}
          tone={counts.photo > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAddOpen(true)}>
          <PlusIcon className="size-4" />
          Aufnehmen
        </Button>
        <Button variant="outline" onClick={() => setInviteOpen(true)}>
          Ehemalige einladen
          {formerMembers.length > 0 ? (
            <span className="text-muted-foreground tabular-nums">{formerMembers.length}</span>
          ) : null}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Erinnern &amp; Fotoliste</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem
              disabled={counts.open === 0 || isPending}
              onSelect={() => setReminder("onboarding")}
            >
              Onboarding-Erinnerung ({counts.open})
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={remindablePhotoCount === 0 || isPending}
              onSelect={() => setReminder("photo")}
            >
              Fotoerlaubnis-Erinnerung ({remindablePhotoCount})
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={`/api/photo-consents/export?showId=${encodeURIComponent(showId)}&format=pdf`}
              >
                Fotoliste als PDF
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/photo-consents/export?showId=${encodeURIComponent(showId)}`}>
                Fotoliste als CSV
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {links ? <InviteLinks result={links} onClose={() => setLinks(null)} /> : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            aria-label="Mitglieder filtern"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: `Alle ${current.length}` },
              { value: "open", label: `Offen ${counts.open}`, disabled: counts.open === 0 },
              { value: "photo", label: `Foto ${counts.photo}`, disabled: counts.photo === 0 },
              { value: "left", label: `Ehemalig ${counts.left}`, disabled: counts.left === 0 },
            ]}
            fullWidth
            className="sm:w-auto"
          />
          <div className="relative sm:w-64">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name suchen"
              aria-label="Mitglieder durchsuchen"
              className="pl-9"
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {members.length === 0 ? "Noch niemand in dieser Produktion." : "Niemand gefunden."}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {visible.map((member) => (
              <li key={member.id}>
                <ListRow
                  onClick={() => setEditId(member.id)}
                  leading={<Initials name={member.name} muted={member.status === "left"} />}
                  title={member.name}
                  description={member.status === "left" ? "Ausgeschieden" : describeMember(member)}
                  trailing={
                    member.status === "left" ? null : (
                      <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                        {isOpen(member) ? (
                          <Hint tone="warning">{MEMBERSHIP_STATUS_LABELS[member.status]}</Hint>
                        ) : null}
                        {needsPhoto(member) ? (
                          <Hint tone="warning">{PHOTO_LABELS[member.photoStatus]}</Hint>
                        ) : null}
                        {member.deactivated ? <Hint tone="muted">Konto deaktiviert</Hint> : null}
                      </span>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <MemberSheet member={editing} onClose={() => setEditId(null)} />

      <AddMemberSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        showId={showId}
        candidates={candidates}
      />

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        showId={showId}
        formerMembers={formerMembers}
        onInvited={(result) => {
          setInviteOpen(false);
          setLinks(result);
        }}
      />

      <ConfirmDialog
        open={reminder !== null}
        onOpenChange={(open) => !open && setReminder(null)}
        title={
          reminder === "onboarding"
            ? `${counts.open} Personen an das Onboarding erinnern?`
            : `${remindablePhotoCount} Personen an die Fotoerlaubnis erinnern?`
        }
        description={
          reminder === "onboarding"
            ? "Jede Person bekommt einen neuen persönlichen Link per Mail."
            : "Erinnert wird, wer keine oder eine abgelehnte Fotoerlaubnis hat."
        }
        confirmLabel="Erinnern"
        cancelLabel="Abbrechen"
        variant="default"
        onConfirm={() => {
          const kind = reminder;
          setReminder(null);
          if (kind) sendReminder(kind);
        }}
        onCancel={() => setReminder(null)}
      />
    </div>
  );
}

function MemberSheet({ member, onClose }: { member: EnsembleMember | null; onClose: () => void }) {
  return (
    <BottomSheet
      open={member !== null}
      onOpenChange={(open) => !open && onClose()}
      title={member?.name ?? "Mitglied"}
      description="Rollen und Mitgliedschaft in dieser Produktion"
    >
      {member ? <MemberSheetBody key={member.id} member={member} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

function MemberSheetBody({ member, onDone }: { member: EnsembleMember; onDone: () => void }) {
  const router = useRouter();
  const [roles, setRoles] = useState<ProductionRole[]>(member.roles);
  const [func, setFunc] = useState(member.func ?? "");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isLeft = member.status === "left";
  const dirty =
    func.trim() !== (member.func ?? "") ||
    roles.length !== member.roles.length ||
    roles.some((role) => !member.roles.includes(role));

  const toggleRole = (role: ProductionRole) =>
    setRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );

  const save = () =>
    startTransition(async () => {
      const formData = new FormData();
      formData.set("membershipId", member.id);
      roles.forEach((role) => formData.append("roles", role));
      formData.set("function", func.trim());
      const result = await updateProductionMemberAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Gespeichert.");
      router.refresh();
      onDone();
    });

  const leave = () =>
    startTransition(async () => {
      const formData = new FormData();
      formData.set("membershipId", member.id);
      const result = await removeProductionMemberAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Mitgliedschaft beendet.");
      router.refresh();
      onDone();
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1">
        <Hint tone={isOpen(member) ? "warning" : "muted"}>
          {MEMBERSHIP_STATUS_LABELS[member.status]}
        </Hint>
        <Hint tone={member.onboardingDone ? "muted" : "warning"}>
          {member.onboardingDone
            ? member.isReturning
              ? "Onboarding (Rückkehr) abgeschlossen"
              : "Onboarding abgeschlossen"
            : "Onboarding offen"}
        </Hint>
        <Hint tone={needsPhoto(member) ? "warning" : "muted"}>
          {PHOTO_LABELS[member.photoStatus]}
        </Hint>
        {member.deactivated ? <Hint tone="muted">Konto deaktiviert</Hint> : null}
      </div>

      {isLeft ? null : (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Rollen in dieser Produktion</h3>
            <div className="flex flex-wrap gap-2">
              {PRODUCTION_ROLES.map((role) => {
                const active = roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleRole(role)}
                    className={cn(
                      "min-h-10 rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="space-y-2">
            <label htmlFor={`function-${member.id}`} className="text-sm font-medium">
              Funktion
            </label>
            <Input
              id={`function-${member.id}`}
              value={func}
              onChange={(event) => setFunc(event.target.value)}
              placeholder="z. B. Licht, Regieassistenz"
              maxLength={120}
            />
          </section>
          <Button className="w-full" onClick={save} disabled={!dirty || isPending}>
            Speichern
          </Button>
        </>
      )}

      <div className="divide-y divide-border rounded-lg border border-border">
        <ListRow
          href={`/mitglieder/mitgliederverwaltung/${member.userId}`}
          title="Profil in der Mitgliederverwaltung"
        />
        {isLeft ? null : (
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            disabled={isPending}
            className="flex min-h-12 w-full items-center px-3 text-left text-sm font-medium text-destructive transition hover:bg-destructive/10"
          >
            Mitgliedschaft beenden
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`Mitgliedschaft von ${member.name} beenden?`}
        description="Die Person verliert den Zugriff auf diese Produktion. Andere Produktionen bleiben unberührt."
        confirmLabel="Beenden"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => {
          setConfirmLeave(false);
          leave();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}

function SearchField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Name suchen"
        aria-label={label}
        className="pl-9"
      />
    </div>
  );
}

function AddMemberSheet({
  open,
  onOpenChange,
  showId,
  candidates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showId: string;
  candidates: AddableMember[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const q = normalize(query.trim());
  const visible = candidates.filter((candidate) => !q || normalize(candidate.label).includes(q));

  const add = (candidate: AddableMember) => {
    setPendingId(candidate.id);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("showId", showId);
      formData.set("userId", candidate.id);
      const result = await addProductionMemberAction(formData);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? `${candidate.label} aufgenommen.`);
      router.refresh();
    });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Mitglied aufnehmen"
      description="Antippen nimmt die Person direkt in diese Produktion auf."
      showDescription
    >
      <div className="space-y-3 pt-1">
        <SearchField value={query} onChange={setQuery} label="Personen durchsuchen" />
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Niemand gefunden.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {visible.map((candidate) => (
              <li key={candidate.id}>
                <ListRow
                  onClick={() => add(candidate)}
                  leading={<Initials name={candidate.label} />}
                  title={candidate.label}
                  chevron={false}
                  trailing={
                    pendingId === candidate.id ? (
                      <span>Wird aufgenommen …</span>
                    ) : (
                      <PlusIcon className="size-4" />
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}

function InviteSheet({
  open,
  onOpenChange,
  showId,
  formerMembers,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showId: string;
  formerMembers: FormerMember[];
  onInvited: (result: InviteFormerMembersResult) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const q = normalize(query.trim());
  const visible = formerMembers.filter((member) => !q || normalize(member.name).includes(q));
  // Eingeladene verschwinden nach dem Neuladen aus der Liste und damit aus der Auswahl.
  const selectedIds = formerMembers
    .filter((member) => selected.has(member.id))
    .map((member) => member.id);
  const allVisibleSelected =
    visible.length > 0 && visible.every((member) => selected.has(member.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const invite = () =>
    startTransition(async () => {
      const formData = new FormData();
      formData.set("showId", showId);
      selectedIds.forEach((id) => formData.append("userIds", id));
      const result = await inviteFormerMembersAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setSelected(new Set());
      router.refresh();
      onInvited(result);
    });

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Ehemalige einladen"
      description="Jede Person bekommt einen persönlichen Link: anmelden, Angaben prüfen, Fotoerlaubnis geben – danach ist sie wieder freigeschaltet."
      showDescription
      footer={
        formerMembers.length > 0 ? (
          <Button
            className="w-full"
            onClick={invite}
            disabled={isPending || selectedIds.length === 0}
          >
            {selectedIds.length === 1
              ? "1 Person einladen"
              : `${selectedIds.length} Personen einladen`}
          </Button>
        ) : undefined
      }
    >
      {formerMembers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Alle Mitglieder früherer Produktionen sind bereits dabei.
        </p>
      ) : (
        <div className="space-y-3 pt-1">
          <SearchField value={query} onChange={setQuery} label="Ehemalige durchsuchen" />
          <label className="flex items-center gap-3 px-3 text-sm font-medium">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={() =>
                setSelected((current) => {
                  const next = new Set(current);
                  visible.forEach((member) =>
                    allVisibleSelected ? next.delete(member.id) : next.add(member.id),
                  );
                  return next;
                })
              }
            />
            {q
              ? `Alle Treffer auswählen (${visible.length})`
              : `Alle auswählen (${visible.length})`}
          </label>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {visible.map((member) => (
              <li key={member.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <Checkbox
                    checked={selected.has(member.id)}
                    onCheckedChange={() => toggle(member.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      zuletzt {member.lastProduction}
                      {member.hasEmail ? "" : " · keine E-Mail"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BottomSheet>
  );
}

function InviteLinks({
  result,
  onClose,
}: {
  result: InviteFormerMembersResult;
  onClose: () => void;
}) {
  if (!result.ok) return null;
  const withLinks = result.outcomes.filter((outcome) => outcome.link);
  if (withLinks.length === 0) return null;
  return (
    <section className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Links zum Weitergeben</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Ausblenden
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Je einmal nutzbar, 30 Tage gültig.</p>
      <ul className="divide-y divide-border rounded-md border border-border bg-background">
        {withLinks.map((outcome) => (
          <li key={outcome.userId} className="flex items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{outcome.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {OUTCOME_LABELS[outcome.status]}
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(outcome.link ?? "")
                  .then(() => toast.success("Link kopiert"))
                  .catch((error: unknown) => {
                    console.error("[ensemble] Kopieren fehlgeschlagen", error);
                    toast.error("Kopieren fehlgeschlagen");
                  });
              }}
            >
              <CopyIcon className="size-4" />
              Kopieren
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
