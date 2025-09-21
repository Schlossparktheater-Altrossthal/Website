"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { ChevronDown, ChevronUp, Copy, Download, ExternalLink, Power, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
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
  shareUrl: string | null;
  isActive: boolean;
};

type CreateInviteState = {
  label: string;
  note: string;
  expiresAt: string;
  maxUses: string;
  roles: Role[];
};

type FreshInvite = {
  id: string;
  token: string;
  inviteUrl: string;
  shareUrl: string | null;
  label: string | null;
  note: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  roles: Role[];
};

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
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshInvite, setFreshInvite] = useState<FreshInvite | null>(null);
  const [origin, setOrigin] = useState("");
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [downloadingPdfFor, setDownloadingPdfFor] = useState<string | null>(null);
  const [expandedInviteId, setExpandedInviteId] = useState<string | null>(null);
  const freshInviteId = freshInvite?.id ?? null;
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

      setDownloadingPdfFor(invite.id);
      try {
        const response = await fetch("/api/pdfs/onboarding-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            link: absoluteUrl,
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
        const inviteId = typeof data.invite.id === "string" && data.invite.id.trim().length
          ? data.invite.id
          : data.invite.token;
        const sharePath = data.invite.shareUrl ?? data.invite.inviteUrl;
        setFreshInvite({
          id: inviteId,
          token: data.invite.token,
          inviteUrl: data.invite.inviteUrl,
          shareUrl: data.invite.shareUrl ?? null,
          label: data.invite.label ?? null,
          note: data.invite.note ?? null,
          expiresAt: data.invite.expiresAt ?? null,
          maxUses: typeof data.invite.maxUses === "number" ? data.invite.maxUses : null,
          roles: Array.isArray(data.invite.roles) ? data.invite.roles : [],
        });
        try {
          const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
          if (base) {
            await navigator.clipboard.writeText(base + sharePath);
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
      await navigator.clipboard.writeText(base + (freshInvite.shareUrl ?? freshInvite.inviteUrl));
      toast.success("Link kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  const copyInviteLink = async (url: string) => {
    if (!url) return;
    try {
      const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
      if (!base) throw new Error("no-origin");
      await navigator.clipboard.writeText(base + url);
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
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-2 border-primary/50 px-3 text-xs text-primary hover:bg-primary/10"
                  onClick={copyFreshInvite}
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
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-2 px-3 text-xs text-primary hover:bg-primary/15"
                  asChild
                >
                  <a href={freshInvite.shareUrl ?? freshInvite.inviteUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Öffnen
                  </a>
                </Button>
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
              {(resolvedOrigin ? resolvedOrigin : "") + (freshInvite.shareUrl ?? freshInvite.inviteUrl)}
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
                const isProcessing = processingInviteId === invite.id;
                const isDownloading = downloadingPdfFor === invite.id;
                const metaItems = [`Erstellt am ${formatDate(invite.createdAt)}`];
                if (invite.expiresAt) {
                  metaItems.push(`Gültig bis ${formatDate(invite.expiresAt)}`);
                }
                if (invite.maxUses !== null) {
                  metaItems.push(`${invite.usageCount} / ${invite.maxUses} genutzt`);
                } else {
                  metaItems.push(`${invite.usageCount} Nutzungen`);
                }
                const menuItems = [
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
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase text-muted-foreground">Onboarding-Link</p>
                            {sharePath ? (
                              <>
                                <code className="block break-all rounded-md bg-card/80 px-3 py-2 font-mono text-xs text-foreground">
                                  {(resolvedOrigin ? resolvedOrigin : "") + sharePath}
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
