"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeRoles, ROLE_LABELS, ROLES, sortRoles, type Role } from "@/lib/roles";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";

export function AddMemberModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [roles, setRoles] = useState<Role[]>(["member"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (role: Role) => {
    setError(null);
    setRoles((prev) => {
      const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
      return sortRoles(next.length ? next : ["member"]);
    });
  };

  const resetForm = () => {
    setEmail("");
    setName("");
    setPassword("");
    setConfirmPassword("");
    setRoles(["member"]);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("E-Mail wird benötigt");
      return;
    }
    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          roles,
          password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Benutzer konnte nicht erstellt werden");
      }
      toast.success(`Benutzer ${data?.user?.email ?? email} angelegt`);
      resetForm();
      setOpen(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Benutzer hinzufügen
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!saving) {
            setOpen(false);
            resetForm();
          }
        }}
        title="Benutzer erstellen"
        description="E-Mail, Passwort und Rollen festlegen"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">E-Mail</span>
              <Input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="person@example.com"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Name (optional)</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Vorname Nachname"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Passwort</span>
              <Input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mindestens 6 Zeichen"
                autoComplete="new-password"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Passwort bestätigen</span>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nochmals eingeben"
                autoComplete="new-password"
              />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Rollen</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((role) => {
                const active = roles.includes(role);
                return (
                  <label
                    key={role}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none"
                      checked={active}
                      onChange={() => toggleRole(role)}
                    />
                    <span>{ROLE_LABELS[role] ?? role}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Primäre Rolle: {describeRoles([roles[0]])}
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!saving) {
                  setOpen(false);
                  resetForm();
                }
              }}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Erstelle…" : "Benutzer anlegen"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
