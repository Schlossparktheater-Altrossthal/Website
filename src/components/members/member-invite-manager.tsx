"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { ChevronDown, ChevronUp, Copy, Download, ExternalLink, Pencil, Power, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, ROLES, sortRoles } from "@/lib/roles";
import {
  onboardingPathForToken,
  onboardingShortPathForInvite,
  resolveOnboardingVariant,
} from "@/lib/member-invite-links";
import { cn } from "@/lib/utils";
import { formatRelativeFromNow } from "@/lib/datetime";

const ASSIGNABLE_ROLES = ROLES.filter((role) => role !== "admin" && role !== "owner");
const ASSIGNABLE_ROLE_SET = new Set<Role>(ASSIGNABLE_ROLES);

function extractErrorMessage(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const message = extractErrorMessage(entry);
      if (message) return message;
    }
    return null;
  }
  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if ("message" in record) {
      const message = extractErrorMessage(record.message);
      if (message) return message;
    }
    if ("error" in record) {
      const nested = extractErrorMessage(record.error);
      if (nested) return nested;
    }
    for (const value of Object.values(record)) {
      const message = extractErrorMessage(value);
      if (message) return message;
    }
  }
  return null;
}

const statusLabelMap = {
  active: { label: "Aktiv", variant: "default" as const },
  disabled: { label: "Deaktiviert", variant: "secondary" as const },
  expired: { label: "Abgelaufen", variant: "destructive" as const },
  exhausted: { label: "Verbraucht", variant: "outline" as const },
};

const RECENT_ABSOLUTE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

type RecentClickDescriptor = { iso: string; relative: string; absolute: string };

function buildRecentClickDetails(timestamps: string[]): RecentClickDescriptor[] {
  return timestamps
    .map((timestamp) => {
      if (typeof timestamp !== "string") return null;
      const trimmed = timestamp.trim();
      if (!trimmed) return null;
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return null;

      return {
        iso: parsed.toISOString(),
        relative: formatRelativeFromNow(parsed),
        absolute: RECENT_ABSOLUTE_FORMATTER.format(parsed),
      } satisfies RecentClickDescriptor;
    })
    .filter((entry): entry is RecentClickDescriptor => Boolean(entry));
}

function formatProductionLabel(production: ProductionSummary | null | undefined) {
  if (!production) return "Unbekannte Produktion";
  const trimmedTitle = production.title?.trim() ?? "";
  if (trimmedTitle) {
    return `${trimmedTitle} (${production.year})`;
  }
  return `Produktion ${production.year}`;
}

type ProductionSummary = {
  id: string;
  title: string | null;
  year: number;
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
  shareUrl: string | null;
  isActive: boolean;
  recentClicks: string[];
  showId: string;
  production: ProductionSummary | null;
};

type InviteSummaryPayload = Omit<InviteSummary, "recentClicks" | "production"> & {
  recentClicks?: string[];
  show?: ProductionSummary | null;
  production?: ProductionSummary | null;
};

type CreateInviteState = {
  label: string;
  note: string;
  expiresAt: string;
  maxUses: string;
  roles: Role[];
  showId: string;
};

type EditInviteState = {
  label: string;
  note: string;
  expiresAt: string;
  maxUses: string;
  roles: Role[];
  showId: string;
};

type FreshInvite = {
  id: string;
  token: string;
  inviteUrl: string | null;
  shareUrl: string | null;
  label: string | null;
  note: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  roles: Role[];
  showId: string;
  production: ProductionSummary | null;
};

type EditableInviteFields = Pick<InviteSummary, "id" | "label" | "note" | "expiresAt" | "maxUses" | "roles" | "showId" | "production">;

type InviteForPdf = {
  id: string;
  label: string | null;
  note: string | null;
  shareUrl: string | null;
  inviteUrl?: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  roles: Role[];
};

export function MemberInviteManager() {
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [productions, setProductions] = useState<ProductionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshInvite, setFreshInvite] = useState<FreshInvite | null>(null);
  const [origin, setOrigin] = useState("");
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [downloadingPdfFor, setDownloadingPdfFor] = useState<string | null>(null);
  const [expandedInviteId, setExpandedInviteId] = useState<string | null>(null);
  const [editingInvite, setEditingInvite] = useState<EditableInviteFields | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [updatingInviteId, setUpdatingInviteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditInviteState>({
    label: "",
    note: "",
    expiresAt: "",
    maxUses: "",
    roles: ["member"],
    showId: "",
  });
  const [lockedRoles, setLockedRoles] = useState<Role[]>([]);
  const normalizeRoles = useCallback(
    (roles: Role[]): Role[] => {
      const deduped = Array.from(new Set(roles));
      const normalized = sortRoles(deduped.length ? deduped : (["member"] as Role[]));
      return normalized.length ? normalized : (["member"] as Role[]);
    },
    [],
  );
  const freshInviteId = freshInvite?.id ?? null;
  const editingInviteId = editingInvite?.id ?? null;
  const isUpdatingCurrentInvite = editingInviteId ? updatingInviteId === editingInviteId : false;
  useEffect(() => {
    if (freshInviteId) {
      setExpandedInviteId(freshInviteId);
    }
  }, [freshInviteId]);
  const resolvedOrigin = useMemo(() => {
    if (origin) return origin;
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }, [origin]);
  const buildAbsoluteUrl = useCallback(
    (path: string | null | undefined) => {
      if (!path) return null;
      if (/^https?:\/\//i.test(path)) return path;
      const base = resolvedOrigin || (typeof window !== "undefined" ? window.location.origin : "");
      if (!base) return null;
      if (path.startsWith("/")) return `${base}${path}`;
      return `${base}/${path}`;
    },
    [resolvedOrigin],
  );
  const freshInviteLinkDetails = useMemo<{
    target: string | null;
    display: string;
  }>(() => {
    if (!freshInvite) {
      return { target: null, display: "" };
    }
    const candidate = freshInvite.shareUrl ?? freshInvite.inviteUrl ?? null;
    const absolute = buildAbsoluteUrl(candidate);
    return {
      target: candidate,
      display: absolute ?? candidate ?? "",
    };
  }, [freshInvite, buildAbsoluteUrl]);

  const extractFilenameFromDisposition = (disposition: string | null) => {
    if (!disposition) return null;
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }
    const quotedMatch = disposition.match(/filename="([^"\\]*(?:\\.[^"\\]*)*)"/i);
    if (quotedMatch?.[1]) {
      return quotedMatch[1].replace(/\\"/g, "").replace(/\\/g, "").trim();
    }
    const simpleMatch = disposition.match(/filename=([^;]+)/i);
    if (simpleMatch?.[1]) {
      return simpleMatch[1].replace(/"/g, "").trim();
    }
    return null;
  };

  const requestInvitePdf = useCallback(
    async (invite: InviteForPdf) => {
      const urlCandidate = invite.shareUrl ?? invite.inviteUrl ?? null;
      if (!urlCandidate) {
        toast.error("Für diesen Link steht keine öffentliche URL zur Verfügung.");
        return;
      }

      const absoluteUrl = buildAbsoluteUrl(urlCandidate);
      if (!absoluteUrl) {
        toast.error("PDF kann nur im Browser generiert werden.");
        return;
      }

      const shortPath = invite.id ? onboardingShortPathForInvite(invite.id, invite.roles) : null;
      const absoluteDisplayLink = shortPath ? buildAbsoluteUrl(shortPath) : null;

      setDownloadingPdfFor(invite.id);
      try {
        const response = await fetch("/api/pdfs/onboarding-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            link: absoluteUrl,
            displayLink: absoluteDisplayLink ?? absoluteUrl,
            headline: invite.label,
            inviteLabel: invite.label,
            note: invite.note,
            expiresAt: invite.expiresAt,
            maxUses: invite.maxUses,
            roles: invite.roles,
          }),
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          throw new Error(errorPayload?.error ?? "PDF konnte nicht erstellt werden");
        }

        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition");
        const filenameFromHeader = extractFilenameFromDisposition(disposition);
        let filename = filenameFromHeader?.trim() || "onboarding-link.pdf";
        filename = filename.replace(/[/\\]/g, "_");
        if (!filename.toLowerCase().endsWith(".pdf")) {
          filename = `${filename}.pdf`;
        }

        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(downloadUrl);
        toast.success("PDF wurde heruntergeladen.");
      } catch (err) {
        console.error("[MemberInviteManager] pdf", err);
        const message = err instanceof Error ? err.message : "PDF konnte nicht erstellt werden";
        toast.error(message);
      } finally {
        setDownloadingPdfFor(null);
      }
    },
    [buildAbsoluteUrl],
  );
  const [form, setForm] = useState<CreateInviteState>({
    label: "",
    note: "",
    expiresAt: "",
    maxUses: "",
    roles: ["member"],
    showId: "",
  });

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/member-invites", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          extractErrorMessage(data?.error ?? null) ??
          extractErrorMessage(data) ??
          response.statusText ??
          "Einladungen konnten nicht geladen werden";
        setError(message);
        return;
      }
      const invitesPayload = Array.isArray(data?.invites)
        ? (data.invites as (InviteSummaryPayload & { show?: ProductionSummary | null })[])
        : [];
      const productionsPayload = Array.isArray(data?.productions)
        ? (data.productions as ProductionSummary[])
        : [];
      setProductions(productionsPayload);

      const normalizedInvites: InviteSummary[] = invitesPayload.map((invite) => {
        const production = invite.production ?? invite.show ?? null;
        const showId = invite.showId ?? production?.id ?? "";
        return {
          ...invite,
          production,
          showId,
          recentClicks: Array.isArray(invite.recentClicks) ? invite.recentClicks : [],
        };
      });
      setInvites(normalizedInvites);
      setForm((prev) => {
        if (prev.showId) return prev;
        const defaultShowId = productionsPayload[0]?.id ?? "";
        return { ...prev, showId: defaultShowId };
      });
      setFreshInvite((prev) => {
        if (!prev) return prev;
        const match = normalizedInvites.find((entry) => entry.id === prev.id);
        if (!match) return prev;
        const nextShareUrl = match.shareUrl ?? null;
        const nextRoles = Array.isArray(match.roles)
          ? normalizeRoles(match.roles as Role[])
          : prev.roles;
        const fallbackInviteUrl = prev.token
          ? onboardingPathForToken(prev.token, nextRoles)
          : null;
        return {
          ...prev,
          label: match.label ?? null,
          note: match.note ?? null,
          expiresAt: match.expiresAt ?? null,
          maxUses: typeof match.maxUses === "number" ? match.maxUses : null,
          roles: nextRoles,
          showId: match.showId,
          production: match.production,
          shareUrl: nextShareUrl,
          inviteUrl: nextShareUrl ? fallbackInviteUrl : null,
        };
      });
    } catch (err) {
      console.error("[MemberInviteManager] load", err);
      const fallback = "Einladungen konnten nicht geladen werden.";
      if (err instanceof Error) {
        const trimmed = err.message.trim();
        setError(trimmed ? trimmed : fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setLoading(false);
    }
  }, [normalizeRoles]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const resetForm = () => {
    setForm({
      label: "",
      note: "",
      expiresAt: "",
      maxUses: "",
      roles: ["member"],
      showId: productions[0]?.id ?? "",
    });
    setError(null);
  };

  const toggleRole = (role: Role) => {
    setForm((prev) => {
      const has = prev.roles.includes(role);
      const nextRoles = has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role];
      const normalized = normalizeRoles(nextRoles);
      return { ...prev, roles: normalized };
    });
  };

  const resetEditForm = () => {
    setEditForm({
      label: "",
      note: "",
      expiresAt: "",
      maxUses: "",
      roles: ["member"],
      showId: productions[0]?.id ?? "",
    });
    setLockedRoles([]);
  };

  const closeEditModal = () => {
    if (updatingInviteId) return;
    setEditModalOpen(false);
    setEditingInvite(null);
    resetEditForm();
  };

  const formatDateForInput = (iso: string | null) => {
    if (!iso) return "";
    const trimmed = iso.trim();
    if (!trimmed) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (trimmed.length >= 10) {
      return trimmed.slice(0, 10);
    }
    try {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.valueOf())) return "";
      return parsed.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  const openEditModalWith = (invite: EditableInviteFields) => {
    const editableRoles = invite.roles.filter((role) => ASSIGNABLE_ROLE_SET.has(role));
    const locked = invite.roles.filter((role) => !ASSIGNABLE_ROLE_SET.has(role));
    const dedupedLocked = Array.from(new Set(locked));
    const sanitizedEditable = normalizeRoles(editableRoles.length ? editableRoles : (["member"] as Role[]));
    setLockedRoles(dedupedLocked);
    setEditingInvite({
      ...invite,
      label: invite.label ?? null,
      note: invite.note ?? null,
      maxUses: typeof invite.maxUses === "number" ? invite.maxUses : null,
      expiresAt: invite.expiresAt ?? null,
      roles: normalizeRoles([...sanitizedEditable, ...dedupedLocked]),
    });
    setEditForm({
      label: invite.label ?? "",
      note: invite.note ?? "",
      expiresAt: formatDateForInput(invite.expiresAt ?? null),
      maxUses: typeof invite.maxUses === "number" && Number.isFinite(invite.maxUses)
        ? String(invite.maxUses)
        : "",
      roles: sanitizedEditable,
      showId: invite.showId ?? "",
    });
    setExpandedInviteId(invite.id);
    setEditModalOpen(true);
    setError(null);
  };

  const toggleEditRole = (role: Role) => {
    setEditForm((prev) => {
      const has = prev.roles.includes(role);
      const nextRoles = has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role];
      const normalized = normalizeRoles(nextRoles);
      return { ...prev, roles: normalized };
    });
  };

  const handleUpdate = async () => {
    if (!editingInvite) return;

    setUpdatingInviteId(editingInvite.id);
    setError(null);
    try {
      const trimmedLabel = editForm.label.trim();
      const trimmedNote = editForm.note.trim();
      const trimmedExpires = editForm.expiresAt.trim();
      const trimmedMaxUses = editForm.maxUses.trim();
      const parsedMaxUses = trimmedMaxUses ? Number(trimmedMaxUses) : null;
      if (!editForm.showId) {
        throw new Error("Bitte wähle eine Produktion aus.");
      }

      const payload = {
        label: trimmedLabel || null,
        note: trimmedNote || null,
        expiresAt: trimmedExpires || null,
        maxUses: trimmedMaxUses
          ? Number.isFinite(parsedMaxUses)
            ? parsedMaxUses
            : null
          : null,
        roles: normalizeRoles([...editForm.roles, ...lockedRoles]),
        showId: editForm.showId,
      };

      const response = await fetch(`/api/member-invites/${editingInvite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Einladung konnte nicht aktualisiert werden");
      }

      const updatedInvite = data?.invite as
        | (InviteSummaryPayload & { roles?: Role[] })
        | undefined;
      if (updatedInvite && typeof updatedInvite.id === "string") {
        setExpandedInviteId(updatedInvite.id);
        if (freshInvite?.id === updatedInvite.id) {
          setFreshInvite((prev) => {
            if (!prev) return prev;
            const nextShareUrl = updatedInvite.isActive ? prev.shareUrl : null;
            const nextRoles = Array.isArray(updatedInvite.roles)
              ? normalizeRoles(updatedInvite.roles as Role[])
              : prev.roles;
            const fallbackInviteUrl = prev.token
              ? onboardingPathForToken(prev.token, nextRoles)
              : null;
            return {
              ...prev,
              label: updatedInvite.label ?? null,
              note: updatedInvite.note ?? null,
              expiresAt: updatedInvite.expiresAt ?? null,
              maxUses: typeof updatedInvite.maxUses === "number" ? updatedInvite.maxUses : null,
              roles: nextRoles,
              showId:
                typeof updatedInvite.showId === "string" && updatedInvite.showId.trim()
                  ? updatedInvite.showId
                  : prev.showId,
              production:
                updatedInvite.show && typeof updatedInvite.show === "object"
                  ? (updatedInvite.show as ProductionSummary)
                  : prev.production,
              shareUrl: nextShareUrl,
              inviteUrl: nextShareUrl ? fallbackInviteUrl : null,
            };
          });
        }
      }

      toast.success("Einladung aktualisiert");
      resetEditForm();
      setEditingInvite(null);
      setEditModalOpen(false);
      await loadInvites();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Einladung konnte nicht aktualisiert werden";
      setError(message);
      toast.error(message);
    } finally {
      setUpdatingInviteId(null);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      if (!form.showId) {
        throw new Error("Bitte wähle eine Produktion aus.");
      }

      const payload = {
        label: form.label || null,
        note: form.note || null,
        expiresAt: form.expiresAt || null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        roles: form.roles,
        showId: form.showId,
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
      if (data?.invite) {
        const inviteId = typeof data.invite.id === "string" && data.invite.id.trim().length
          ? data.invite.id
          : data.invite.token;
        const createdRoles = normalizeRoles(
          Array.isArray(data.invite.roles)
            ? (data.invite.roles as Role[])
            : form.roles,
        );
        const computedInviteUrl = data.invite.token
          ? onboardingPathForToken(data.invite.token, createdRoles)
          : null;
        const linkCandidate = typeof data.invite.shareUrl === "string"
          ? data.invite.shareUrl
          : data.invite.inviteUrl ?? computedInviteUrl;
        setFreshInvite({
          id: inviteId,
          token: data.invite.token,
          inviteUrl:
            typeof data.invite.inviteUrl === "string"
              ? data.invite.inviteUrl
              : computedInviteUrl,
          shareUrl: data.invite.shareUrl ?? null,
          label: data.invite.label ?? null,
          note: data.invite.note ?? null,
          expiresAt: data.invite.expiresAt ?? null,
          maxUses: typeof data.invite.maxUses === "number" ? data.invite.maxUses : null,
          roles: createdRoles,
          showId: typeof data.invite.showId === "string" ? data.invite.showId : form.showId,
          production:
            data.invite.show && typeof data.invite.show === "object"
              ? (data.invite.show as ProductionSummary)
              : productions.find((entry) => entry.id === form.showId) ?? null,
        });
        try {
          const absolute = buildAbsoluteUrl(linkCandidate);
          if (absolute) {
            await navigator.clipboard.writeText(absolute);
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
      const absolute = buildAbsoluteUrl(freshInvite.shareUrl ?? freshInvite.inviteUrl);
      if (!absolute) throw new Error("no-url");
      await navigator.clipboard.writeText(absolute);
      toast.success("Link kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  const copyInviteLink = async (url: string | null | undefined) => {
    if (!url) return;
    try {
      const absolute = buildAbsoluteUrl(url);
      if (!absolute) throw new Error("no-url");
      await navigator.clipboard.writeText(absolute);
      toast.success("Link kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  const toggleInvite = async (invite: InviteSummary) => {
    setProcessingInviteId(invite.id);
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
    } finally {
      setProcessingInviteId(null);
    }
  };

  const deleteInvite = async (invite: InviteSummary) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Möchtest du diesen Onboarding-Link wirklich löschen? Dieser Schritt kann nicht rückgängig gemacht werden.",
      );
      if (!confirmed) return;
    }

    setProcessingInviteId(invite.id);
    setError(null);
    try {
      const response = await fetch(`/api/member-invites/${invite.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Einladung konnte nicht gelöscht werden");
      }
      toast.success("Einladung gelöscht");
      if (freshInvite?.id === invite.id) {
        setFreshInvite(null);
      }
      await loadInvites();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Einladung konnte nicht gelöscht werden";
      setError(message);
      toast.error(message);
    } finally {
      setProcessingInviteId(null);
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
    <Card className="border border-border/60 bg-card/80 shadow-sm">
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
          <div className="rounded-lg border border-primary/50 bg-primary/10 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Neuer Onboarding-Link erstellt</p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Kopiere den Link für den Versand oder öffne ihn direkt in einem neuen Tab.
                </p>
                {freshInvite.production ? (
                  <Badge variant="outline" className="mt-1 border-primary/50 text-primary">
                    {formatProductionLabel(freshInvite.production)}
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-2 border-primary/50 px-3 text-xs text-primary hover:bg-primary/10"
                  onClick={copyFreshInvite}
                  disabled={!freshInviteLinkDetails.target}
                >
                  <Copy className="h-4 w-4" />
                  Link kopieren
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-2 border-primary/50 px-3 text-xs text-primary hover:bg-primary/10"
                  onClick={() => {
                    if (!freshInvite) return;
                    openEditModalWith({
                      id: freshInvite.id,
                      label: freshInvite.label,
                      note: freshInvite.note,
                      expiresAt: freshInvite.expiresAt,
                      maxUses: freshInvite.maxUses,
                      roles: freshInvite.roles,
                      showId: freshInvite.showId,
                      production: freshInvite.production,
                    });
                  }}
                  disabled={updatingInviteId === freshInvite.id}
                >
                  <Pencil className="h-4 w-4" />
                  Details bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-2 border-primary/50 px-3 text-xs text-primary hover:bg-primary/10"
                  onClick={() => {
                    if (!freshInvite) return;
                    void requestInvitePdf({
                      id: freshInvite.id,
                      label: freshInvite.label,
                      note: freshInvite.note,
                      shareUrl: freshInvite.shareUrl,
                      inviteUrl: freshInvite.inviteUrl,
                      expiresAt: freshInvite.expiresAt,
                      maxUses: freshInvite.maxUses,
                      roles: freshInvite.roles,
                    });
                  }}
                  disabled={downloadingPdfFor === freshInvite.id}
                >
                  {downloadingPdfFor === freshInvite.id ? (
                    "PDF wird erstellt …"
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      PDF generieren
                    </>
                  )}
                </Button>
                {freshInviteLinkDetails.target ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-2 px-3 text-xs text-primary hover:bg-primary/15"
                    asChild
                  >
                    <a href={freshInviteLinkDetails.display || undefined} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Öffnen
                    </a>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-2 px-3 text-xs text-primary hover:bg-primary/15"
                  onClick={() => setFreshInvite(null)}
                >
                  Ausblenden
                </Button>
              </div>
            </div>
            <code className="mt-3 block break-all rounded-md bg-card/80 px-3 py-2 font-mono text-xs text-foreground">
              {freshInviteLinkDetails.display || "Kein Link verfügbar"}
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Der Link ist zusätzlich in der Übersicht hervorgehoben.
            </p>
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
              const isFresh = freshInvite?.id === invite.id;
              const isExpanded = expandedInviteId === invite.id;
              const sharePath = invite.shareUrl ?? null;
              const shareLinkDisplay = sharePath ? buildAbsoluteUrl(sharePath) ?? sharePath : null;
              const isProcessing = processingInviteId === invite.id;
              const isDownloading = downloadingPdfFor === invite.id;
              const metaItems: string[] = [];
              if (invite.production) {
                metaItems.push(formatProductionLabel(invite.production));
              }
              if (resolveOnboardingVariant(invite.roles) === "regie") {
                metaItems.push("Variante: Regie-Onboarding");
              }
              metaItems.push(`Erstellt am ${formatDate(invite.createdAt)}`);
                if (invite.expiresAt) {
                  metaItems.push(`Gültig bis ${formatDate(invite.expiresAt)}`);
                }
                if (invite.maxUses !== null) {
                  metaItems.push(`${invite.usageCount} / ${invite.maxUses} genutzt`);
                } else {
                  metaItems.push(`${invite.usageCount} Nutzungen`);
                }
                const menuItems = [
                  {
                    label: "Details bearbeiten",
                    icon: <Pencil className="h-4 w-4" />,
                    onClick: () => {
                      if (updatingInviteId) return;
                      openEditModalWith(invite);
                    },
                  },
                  ...(sharePath
                    ? [
                        {
                          label: "Link kopieren",
                          icon: <Copy className="h-4 w-4" />,
                          onClick: () => {
                            void copyInviteLink(sharePath);
                          },
                        },
                        {
                          label: isDownloading ? "PDF wird erstellt …" : "PDF generieren",
                          icon: <Download className="h-4 w-4" />,
                          onClick: () => {
                            if (isDownloading) return;
                            void requestInvitePdf({
                              id: invite.id,
                              label: invite.label,
                              note: invite.note,
                              shareUrl: invite.shareUrl,
                              expiresAt: invite.expiresAt,
                              maxUses: invite.maxUses,
                              roles: invite.roles,
                            });
                          },
                        },
                        {
                          label: "Im neuen Tab öffnen",
                          icon: <ExternalLink className="h-4 w-4" />,
                          onClick: () => {
                            const absolute = buildAbsoluteUrl(sharePath);
                            if (absolute && typeof window !== "undefined") {
                              window.open(absolute, "_blank", "noopener,noreferrer");
                            } else {
                              toast.error("Link kann aktuell nicht geöffnet werden.");
                            }
                          },
                        },
                      ]
                    : []),
                  {
                    label: invite.isDisabled ? "Einladung aktivieren" : "Einladung deaktivieren",
                    icon: <Power className="h-4 w-4" />,
                    onClick: () => {
                      if (isProcessing) return;
                      void toggleInvite(invite);
                    },
                  },
                  {
                    label: "Einladung löschen",
                    icon: <Trash2 className="h-4 w-4" />,
                    onClick: () => {
                      if (isProcessing) return;
                      void deleteInvite(invite);
                    },
                    variant: "destructive" as const,
                  },
                ];
                const recentClickDetails = buildRecentClickDetails(invite.recentClicks);
                return (
                  <div
                    key={invite.id}
                    className={cn(
                      "rounded-lg border border-border/70 bg-card/70 p-4 shadow-sm transition-colors",
                      (isFresh || isExpanded) && "border-primary/60 bg-primary/10",
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">
                            {invite.label?.trim() || "Allgemeiner Link"}
                          </h3>
                          <Badge variant={status.variant} className="px-2 py-0.5 text-[0.65rem] font-medium uppercase">
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {metaItems.map((item, index) => (
                            <span key={`${invite.id}-meta-${index}`} className="flex items-center gap-1">
                              {index > 0 && <span aria-hidden>•</span>}
                              <span>{item}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-2 px-3 text-xs"
                          onClick={() =>
                            setExpandedInviteId((current) => (current === invite.id ? null : invite.id))
                          }
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Details verbergen
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Details anzeigen
                            </>
                          )}
                        </Button>
                        <DropdownMenu items={menuItems} className="h-8" />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                        {invite.note && (
                          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:text-sm">
                            {invite.note}
                          </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <p className="text-xs font-medium uppercase text-muted-foreground">Produktion</p>
                              <p className="text-sm text-foreground">
                                {invite.production ? formatProductionLabel(invite.production) : "–"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase text-muted-foreground">Onboarding-Link</p>
                              {sharePath ? (
                                <>
                                  <code className="block break-all rounded-md bg-card/80 px-3 py-2 font-mono text-xs text-foreground">
                                    {shareLinkDisplay}
                                  </code>
                                  <div className="flex flex-wrap gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-2 px-3 text-xs"
                                    onClick={() => copyInviteLink(sharePath)}
                                  >
                                    <Copy className="h-4 w-4" />
                                    Link kopieren
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-2 px-3 text-xs"
                                    onClick={() => openEditModalWith(invite)}
                                    disabled={updatingInviteId === invite.id}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Details bearbeiten
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-2 px-3 text-xs"
                                    onClick={() => {
                                      if (isDownloading) return;
                                      void requestInvitePdf({
                                        id: invite.id,
                                        label: invite.label,
                                        note: invite.note,
                                        shareUrl: invite.shareUrl,
                                        expiresAt: invite.expiresAt,
                                        maxUses: invite.maxUses,
                                        roles: invite.roles,
                                      });
                                    }}
                                    disabled={isDownloading}
                                  >
                                    {isDownloading ? (
                                      "PDF wird erstellt …"
                                    ) : (
                                      <>
                                        <Download className="h-4 w-4" />
                                        PDF generieren
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 gap-2 px-3 text-xs"
                                    asChild
                                  >
                                    <a href={sharePath} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                      Öffnen
                                    </a>
                                  </Button>
                                </div>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Für diese Einladung ist kein öffentlicher Link freigegeben.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <p className="text-xs font-medium uppercase text-muted-foreground">Rollen</p>
                              <div className="flex flex-wrap gap-2">
                                {invite.roles.map((role) => (
                                  <Badge key={role} variant="outline">
                                    {ROLE_LABELS[role] ?? role}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <p className="text-xs font-medium uppercase text-muted-foreground">Nutzungsübersicht</p>
                                <p className="text-sm text-foreground">
                                  {invite.maxUses !== null
                                    ? `${invite.usageCount} / ${invite.maxUses} genutzt`
                                    : `${invite.usageCount} Nutzungen`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {invite.completedSessions > 0 || invite.pendingSessions > 0
                                    ? `${invite.completedSessions} abgeschlossen · ${invite.pendingSessions} offen`
                                    : "Noch keine Sitzungen registriert."}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                  Letzte Klicks
                                </p>
                                {recentClickDetails.length ? (
                                  <div className="space-y-1.5">
                                    {recentClickDetails.map((entry, index) => (
                                      <div
                                        key={`${invite.id}-recent-${index}-${entry.iso}`}
                                        className="group relative overflow-hidden rounded-lg border border-border/60 bg-card/80 px-3 py-2 shadow-sm backdrop-blur-sm transition hover:border-primary/60"
                                      >
                                        <div
                                          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_0%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_70%)] opacity-70 transition group-hover:opacity-95"
                                          aria-hidden
                                        />
                                        <div className="relative flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-3">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/90 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition group-hover:border-primary/60 group-hover:text-primary">
                                              {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <div className="space-y-0.5">
                                              <p className="text-sm font-medium text-foreground">{entry.relative}</p>
                                              <time
                                                dateTime={entry.iso}
                                                className="text-[11px] uppercase tracking-wide text-muted-foreground"
                                              >
                                                {entry.absolute}
                                              </time>
                                            </div>
                                          </div>
                                          <span
                                            aria-hidden
                                            className="h-2 w-2 rounded-full bg-primary/80 shadow-[0_0_0.75rem_rgba(0,0,0,0.25)] transition group-hover:scale-110 group-hover:bg-primary"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Noch keine Klicks registriert.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <Dialog
        open={editModalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeEditModal();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Details bearbeiten</DialogTitle>
            <DialogDescription>
              Passe Titel, Notizen oder Laufzeit deines Onboarding-Links an. Leere Felder setzen Werte zurück.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Titel</span>
              <Input
                value={editForm.label}
                onChange={(event) => setEditForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder="z.B. Sommercrew 2025"
                disabled={isUpdatingCurrentInvite}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Produktion</span>
              <Select
                value={editForm.showId}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, showId: value }))}
                disabled={isUpdatingCurrentInvite || productions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Produktion wählen" />
                </SelectTrigger>
                <SelectContent>
                  {productions.map((production) => (
                    <SelectItem key={`edit-production-${production.id}`} value={production.id}>
                      {formatProductionLabel(production)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {productions.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Keine Produktionen vorhanden – lege zuerst eine Produktion an.
                </span>
              ) : null}
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Notiz</span>
              <Textarea
                value={editForm.note}
                onChange={(event) => setEditForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Internes Memo für die Verwaltung"
                disabled={isUpdatingCurrentInvite}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Gültig bis</span>
                <Input
                  type="date"
                  value={editForm.expiresAt}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                  disabled={isUpdatingCurrentInvite}
                />
                <span className="text-xs text-muted-foreground">Freilassen für unbegrenzte Laufzeit.</span>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Max. Nutzungen</span>
                <Input
                  type="number"
                  min={1}
                  value={editForm.maxUses}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, maxUses: event.target.value }))}
                  placeholder="Unbegrenzt"
                  disabled={isUpdatingCurrentInvite}
                />
                <span className="text-xs text-muted-foreground">Leer lassen, um keine Grenze zu setzen.</span>
              </label>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Rollen bei Erstellung</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {ASSIGNABLE_ROLES.map((role) => {
                  const checked = editForm.roles.includes(role);
                  return (
                    <label
                      key={`edit-${role}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition",
                        checked ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/60",
                        isUpdatingCurrentInvite && "pointer-events-none opacity-70",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEditRole(role)}
                        className="h-4 w-4"
                        disabled={isUpdatingCurrentInvite}
                      />
                      <span>{ROLE_LABELS[role] ?? role}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Standard bleibt „Mitglied“. Weitere Rollen kannst du jederzeit ergänzen oder entfernen.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 sm:space-x-2">
            <Button type="button" variant="outline" onClick={closeEditModal} disabled={isUpdatingCurrentInvite}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdatingCurrentInvite || !editingInviteId}>
              {isUpdatingCurrentInvite ? "Speichere …" : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            if (creating) return;
            setModalOpen(false);
            resetForm();
          } else {
            setModalOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Einladung erstellen</DialogTitle>
            <DialogDescription>
              Lege optional Ablaufdatum oder maximale Nutzungen fest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Titel (optional)</span>
              <Input
                value={form.label}
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder="z.B. Sommercrew 2025"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Produktion</span>
              <Select
                value={form.showId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, showId: value }))}
                disabled={productions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Produktion wählen" />
                </SelectTrigger>
                <SelectContent>
                  {productions.map((production) => (
                    <SelectItem key={`create-production-${production.id}`} value={production.id}>
                      {formatProductionLabel(production)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {productions.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Keine Produktionen vorhanden – lege zuerst eine Produktion an.
                </span>
              ) : null}
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
          </div>
          <DialogFooter className="gap-2 pt-4 sm:space-x-2">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
