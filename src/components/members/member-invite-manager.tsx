"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { ROLE_LABELS, ROLES, sortRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";

const ASSIGNABLE_ROLES = ROLES.filter((role) => role !== "admin" && role !== "owner");

const statusLabelMap = {
  active: { label: "Aktiv", variant: "default" as const },
  disabled: { label: "Deaktiviert", variant: "secondary" as const },
  expired: { label: "Abgelaufen", variant: "destructive" as const },
  exhausted: { label: "Verbraucht", variant: "outline" as const },
};

type InviteSummary = {
  id: string;
  label: string | null;
  note: string | null;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  usageCount: number;
  roles: Role[];
  isDisabled: boolean;
  remainingUses: number | null;
  isExpired: boolean;
  isExhausted: boolean;
  pendingSessions: number;
  completedSessions: number;
  createdBy: { id: string; name: string | null; email: string | null } | null;
};

type CreateInviteState = {
  label: string;
  note: string;
  expiresAt: string;
  maxUses: string;
  roles: Role[];
};

type FreshInvite = { token: string; inviteUrl: string } | null;

export function MemberInviteManager() {
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshInvite, setFreshInvite] = useState<FreshInvite>(null);
  const [origin, setOrigin] = useState("");
  const [form, setForm] = useState<CreateInviteState>({
    label: "",
    note: "",
    expiresAt: "",
    maxUses: "",
    roles: ["member"],
  });

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/member-invites", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Einladungen konnten nicht geladen werden");
      }
      setInvites(Array.isArray(data?.invites) ? data.invites : []);
    } catch (err) {
      console.error("[MemberInviteManager] load", err);
      setError("Einladungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const resetForm = () => {
    setForm({ label: "", note: "", expiresAt: "", maxUses: "", roles: ["member"] });
    setError(null);
  };

  const toggleRole = (role: Role) => {
    setForm((prev) => {
      const has = prev.roles.includes(role);
      const nextRoles = has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role];
      const normalized = sortRoles(nextRoles.length ? nextRoles : ["member"]);
      return { ...prev, roles: normalized };
    });
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const payload = {
        label: form.label || null,
        note: form.note || null,
        expiresAt: form.expiresAt || null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        roles: form.roles,
      };
      const response = await fetch("/api/member-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Einladung konnte nicht erstellt werden");
      }
      if (data?.invite?.inviteUrl) {
        setFreshInvite({ token: data.invite.token, inviteUrl: data.invite.inviteUrl });
        try {
          const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
          if (base) {
            await navigator.clipboard.writeText(base + data.invite.inviteUrl);
            toast.success("Neuer Link kopiert.");
          } else {
            toast.success("Neue Einladung erstellt. Link siehe unten.");
          }
        } catch {
          toast.success("Neue Einladung erstellt. Link siehe unten.");
        }
      }
      resetForm();
      setModalOpen(false);
      await loadInvites();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Einladung konnte nicht erstellt werden";
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const copyFreshInvite = async () => {
    if (!freshInvite) return;
    try {
      const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
      if (!base) throw new Error("no-origin");
      await navigator.clipboard.writeText(base + freshInvite.inviteUrl);
      toast.success("Link kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  const toggleInvite = async (invite: InviteSummary) => {
    try {
      const response = await fetch(`/api/member-invites/${invite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDisabled: !invite.isDisabled }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Aktion fehlgeschlagen");
      }
      toast.success(invite.isDisabled ? "Einladung aktiviert" : "Einladung deaktiviert");
      await loadInvites();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Aktion fehlgeschlagen";
      toast.error(message);
    }
  };

  const statusForInvite = (invite: InviteSummary) => {
    if (invite.isDisabled) return statusLabelMap.disabled;
    if (invite.isExpired) return statusLabelMap.expired;
    if (invite.isExhausted) return statusLabelMap.exhausted;
    return statusLabelMap.active;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "–";
    try {
      return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const sortedInvites = useMemo(() => invites.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [invites]);

  return (
    <Card className="border border-border/70">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">Einladungslinks</CardTitle>
          <p className="text-sm text-muted-foreground">
            Erstelle moderne Onboarding-Links und behalte den Überblick über Status und Nutzungen.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Link erstellen</Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {freshInvite && (
          <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
            <p className="font-medium">Neuer Link</p>
            <p className="break-all text-xs">{(origin ? origin : "") + freshInvite.inviteUrl}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={copyFreshInvite}>
                Link kopieren
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFreshInvite(null)}
                className="text-primary"
              >
                Ausblenden
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade Einladungen …</p>
          ) : sortedInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Einladungslinks vorhanden.</p>
          ) : (
            <div className="grid gap-4">
              {sortedInvites.map((invite) => {
                const status = statusForInvite(invite);
                return (
                  <div key={invite.id} className="rounded-lg border border-border/70 bg-background/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold">
                          {invite.label?.trim() || "Allgemeiner Link"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Erstellt am {formatDate(invite.createdAt)}</span>
                          {invite.expiresAt && <span>• Gültig bis {formatDate(invite.expiresAt)}</span>}
                          {invite.maxUses !== null && (
                            <span>
                              • {invite.usageCount} / {invite.maxUses} genutzt
                            </span>
                          )}
                        </div>
                        {invite.note && <p className="text-xs text-muted-foreground">{invite.note}</p>}
                        <div className="flex flex-wrap gap-2 pt-2 text-xs">
                          {invite.roles.map((role) => (
                            <Badge key={role} variant="outline">
                              {ROLE_LABELS[role] ?? role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <Button size="sm" variant="outline" onClick={() => toggleInvite(invite)}>
                          {invite.isDisabled ? "Aktivieren" : "Deaktivieren"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (creating) return;
          setModalOpen(false);
        }}
        title="Einladung erstellen"
        description="Lege optional Ablaufdatum oder maximale Nutzungen fest."
      >
        <div className="space-y-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Titel (optional)</span>
            <Input value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="z.B. Sommercrew 2025" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Notiz (optional)</span>
            <Textarea
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Internes Memo für die Verwaltung"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Gültig bis</span>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Max. Nutzungen</span>
              <Input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(event) => setForm((prev) => ({ ...prev, maxUses: event.target.value }))}
                placeholder="Unbegrenzt"
              />
            </label>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Rollen bei Erstellung</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {ASSIGNABLE_ROLES.map((role) => {
                const checked = form.roles.includes(role);
                return (
                  <label
                    key={role}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition",
                      checked ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(role)}
                      className="h-4 w-4"
                    />
                    <span>{ROLE_LABELS[role] ?? role}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Standard ist „Mitglied“. Weitere Rollen können nach dem Onboarding vergeben werden.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (creating) return;
                setModalOpen(false);
                resetForm();
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Erstelle …" : "Link erzeugen"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
