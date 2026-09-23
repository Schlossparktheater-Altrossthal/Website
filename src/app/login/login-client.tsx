"use client";

import { MailCheckIcon, ShieldCheckIcon } from "@/components/ui/action-icons";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, type SignInResponse } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DEV_TEST_USERS } from "@/lib/auth-dev-test-users";

type TestLoginOption = {
  email: string;
  label?: string;
};

const configuredTestLoginEmails = (() => {
  const raw = process.env.NEXT_PUBLIC_AUTH_DEV_TEST_USERS;
  if (!raw) return [] as string[];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
})();

const fallbackTestLoginOptions: TestLoginOption[] =
  process.env.NODE_ENV !== "production"
    ? DEV_TEST_USERS.map((user) => ({ email: user.email, label: user.label }))
    : [];

const TEST_LOGIN_OPTIONS: TestLoginOption[] = (() => {
  if (!configuredTestLoginEmails.length) {
    return fallbackTestLoginOptions;
  }

  const seen = new Set<string>();

  return configuredTestLoginEmails
    .map((email) => email.trim())
    .filter((email) => {
      if (!email) return false;
      const normalized = email.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map((email) => {
      const normalized = email.toLowerCase();
      const preset = DEV_TEST_USERS.find((user) => user.email === normalized);
      if (preset) {
        return { email: preset.email, label: preset.label };
      }
      return { email };
    });
})();

const resetSchema = z.object({ email: z.string().email() });
const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Mindestens 6 Zeichen"),
});

const DEACTIVATED_MESSAGE =
  "Dieses Konto wurde deaktiviert. Bitte wende dich an einen Admin oder tritt der neuen Produktion bei.";
const AUTHENTIK_MIGRATED_MESSAGE =
  "Dein Passwort liegt jetzt in deinem Theater-Konto. Bitte melde dich über „Mit Theater-Konto anmelden“ an.";
const LEGACY_CLOSED_MESSAGE =
  "Die Anmeldung mit dem alten Formular ist beendet. Bitte melde dich über „Mit Theater-Konto anmelden“ an.";

function parseReasonFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.searchParams.get("reason");
  } catch {
    return null;
  }
}

export type LoginPageClientProps = {
  /** Anmeldung über Authentik (SSO) ist konfiguriert. */
  authentikEnabled: boolean;
  /** Mitgliederbereich verwaltet die Authentik-Konten (Passwort-Mail, Migration). */
  authentikProvisioning: boolean;
  /** ÜBERGANGSPHASE: altes Passwortformular noch sichtbar. */
  legacyLoginActive: boolean;
  /** ÜBERGANGSPHASE: Stichtag für das alte Formular (ISO-String) oder null. */
  legacyLoginDeadline: string | null;
};

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const deadline = new Date(iso);
  if (Number.isNaN(deadline.valueOf())) return null;
  // Letzter Tag, an dem das Formular noch funktioniert (Stichtag exklusiv).
  const date = new Date(deadline.valueOf() - 1);
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
}

export function LoginPageClient({
  authentikEnabled,
  authentikProvisioning,
  legacyLoginActive,
  legacyLoginDeadline,
}: LoginPageClientProps) {
  // Use only NEXT_PUBLIC_ var to keep SSR/CSR consistent and avoid hydration mismatches
  const devNoDb = process.env.NEXT_PUBLIC_AUTH_DEV_NO_DB === "1";
  const [loading, setLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [showResetSuggestion, setShowResetSuggestion] = useState(false);
  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: "", password: "" },
  });
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = sp?.get("callbackUrl") ?? "/mitglieder";
  const onboardingToken = sp?.get("onboardingToken") ?? undefined;
  const canResetPassword = authentikProvisioning && !devNoDb;
  const deadlineLabel = formatDeadline(legacyLoginDeadline);

  // Surface NextAuth error from ?error=...
  useEffect(() => {
    const err = sp?.get("error");
    const reason = sp?.get("reason");
    if (err) {
      if (err === "AccessDenied" && reason === "deactivated") {
        toast.error(DEACTIVATED_MESSAGE);
        setShowResetSuggestion(false);
        return;
      }
      if (err === "AccessDenied" && reason === "not-a-member") {
        toast.error(
          "Zu diesem Theater-Konto gibt es kein Mitgliedsprofil. Bitte wende dich an einen Admin.",
        );
        return;
      }
      const map: Record<string, string> = {
        OAuthAccountNotLinked: "Account nicht verknüpft",
        CredentialsSignin: "Ungültige Zugangsdaten",
        AccessDenied: "Zugriff verweigert",
        Verification: "Dieser Link ist ungültig oder abgelaufen",
        default: "Login fehlgeschlagen",
      };
      toast.error(map[err] ?? map.default);
      setShowResetSuggestion(err === "CredentialsSignin");
    }
  }, [sp]);

  async function onAuthentikSignIn() {
    setLoading(true);
    if (onboardingToken) {
      // Wird im signIn-Callback gelesen, um deaktivierte Rückkehrer zu reaktivieren.
      await fetch("/api/auth/onboarding-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: onboardingToken }),
      }).catch((error: unknown) => {
        console.error("[login] Onboarding-Token konnte nicht gespeichert werden", error);
      });
    }
    try {
      await signIn("authentik", { callbackUrl });
    } catch {
      toast.error("Weiterleitung zum Theater-Konto fehlgeschlagen");
      setLoading(false);
    }
  }

  async function onResetSubmit(values: z.infer<typeof resetSchema>) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          ...(onboardingToken ? { onboardingToken } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "E-Mail Versand fehlgeschlagen");
      } else {
        toast.success(
          data?.message ??
            "Falls ein Konto mit dieser E-Mail existiert, erhältst du in Kürze eine E-Mail.",
        );
        setResetDialogOpen(false);
      }
    } catch {
      toast.error("E-Mail Versand fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  async function onPasswordSubmit(values: z.infer<typeof passwordSchema>) {
    setLoading(true);
    try {
      const res: SignInResponse | undefined = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl,
        ...(onboardingToken ? { onboardingToken } : {}),
      });
      if (res?.error) {
        if (parseReasonFromUrl(res.url) === "deactivated") {
          toast.error(DEACTIVATED_MESSAGE);
        } else if (res.code === "authentik_migrated") {
          toast.info(AUTHENTIK_MIGRATED_MESSAGE);
        } else if (res.code === "legacy_login_closed") {
          toast.info(LEGACY_CLOSED_MESSAGE);
        } else {
          toast.error(res.error || "Anmeldung fehlgeschlagen");
          setShowResetSuggestion(canResetPassword);
          resetForm.setValue("email", values.email);
        }
      } else {
        toast.success("Erfolgreich angemeldet");
        setShowResetSuggestion(false);
        if (res?.url) router.push(res.url);
        else router.push(callbackUrl);
      }
    } catch {
      toast.error("Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  async function testLogin(email: string) {
    setLoading(true);
    try {
      const res: SignInResponse | undefined = await signIn("credentials", {
        email,
        dev: "1",
        redirect: false,
        callbackUrl: "/mitglieder",
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Angemeldet als ${email}`);
        // If url present, navigate to members
        if (res?.url) router.push(res.url);
        else router.push("/mitglieder");
      }
    } catch {
      toast.error("Test-Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  const handleOpenReset = () => {
    const emailFromPassword = passwordForm.getValues("email");
    if (emailFromPassword) {
      resetForm.setValue("email", emailFromPassword);
    }
  };

  return (
    <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
      <div className="max-w-sm mx-auto space-y-6">
        <h1 className="font-serif text-3xl">Login</h1>

        {authentikEnabled && !devNoDb && (
          <div className="space-y-3">
            <Button type="button" className="w-full" onClick={onAuthentikSignIn} disabled={loading}>
              <ShieldCheckIcon className="h-4 w-4" />
              Mit Theater-Konto anmelden
            </Button>
            <p className="text-sm text-muted-foreground">
              Ein Konto für den Mitgliederbereich und weitere Dienste des Sommertheaters – Anmeldung
              mit Passwort oder Passkey.
            </p>
          </div>
        )}

        {canResetPassword && (
          <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-muted/70 via-muted/40 to-transparent p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MailCheckIcon className="h-5 w-5" aria-hidden />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Kein Passwort zur Hand?</p>
                  <p className="text-sm text-muted-foreground">
                    Lass dir einen Link zum Festlegen eines neuen Passworts senden.
                  </p>
                </div>
              </div>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline" onClick={handleOpenReset}>
                  Passwort vergessen
                </Button>
              </DialogTrigger>
            </div>
          </div>
        )}

        {legacyLoginActive && (
          <div className="space-y-3">
            {authentikEnabled && !devNoDb && (
              <div className="space-y-1 border-t border-border pt-6">
                <h2 className="text-sm font-semibold">Mit bisherigem Passwort anmelden</h2>
                {authentikProvisioning ? (
                  <p className="text-sm text-muted-foreground">
                    Beim ersten Login wird dein Passwort in dein Theater-Konto übernommen. Danach
                    meldest du dich über den Button oben an.
                    {deadlineLabel ? ` Dieses Formular gibt es noch bis zum ${deadlineLabel}.` : ""}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Anmeldung mit dem Passwort dieser Umgebung, ohne Übernahme ins Theater-Konto.
                  </p>
                )}
              </div>
            )}
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
              className="space-y-3"
              aria-label="Passwort Login"
            >
              <div className="grid gap-3">
                <label className="block text-sm">
                  <span>E-Mail</span>
                  <Input
                    type="email"
                    placeholder="du@example.com"
                    autoComplete="email"
                    {...passwordForm.register("email")}
                    aria-required
                  />
                </label>
                <label className="block text-sm">
                  <span>Passwort</span>
                  <PasswordInput
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...passwordForm.register("password")}
                    aria-required
                  />
                </label>
              </div>
              <Button
                type="submit"
                className="w-full"
                variant={authentikEnabled && !devNoDb ? "outline" : "default"}
                disabled={loading}
              >
                {loading ? "Wird geprüft…" : "Anmelden"}
              </Button>
            </form>
          </div>
        )}

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Passwort zurücksetzen</DialogTitle>
            <DialogDescription>
              Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues
              Passwort für dein Theater-Konto festlegst.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={resetForm.handleSubmit(onResetSubmit)}
            className="space-y-4"
            aria-label="Passwort zurücksetzen"
          >
            <Input
              type="email"
              placeholder="du@example.com"
              autoComplete="email"
              {...resetForm.register("email")}
              aria-required
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setResetDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Senden…" : "Link senden"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>

        {showResetSuggestion && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm text-primary">
            <p className="font-semibold">Passwort vergessen?</p>
            <p className="mt-1">
              Über „Passwort vergessen“ schicken wir dir einen Link an{" "}
              {resetForm.getValues("email") || "deine Adresse"}, mit dem du ein neues Passwort
              festlegst.
            </p>
          </div>
        )}

        {!devNoDb && TEST_LOGIN_OPTIONS.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Test-Logins</p>
            <p>Nur in Entwicklungs- und Testumgebungen verfügbar.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {TEST_LOGIN_OPTIONS.map((option) => (
                <Button
                  key={option.email}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => testLogin(option.email)}
                  disabled={loading}
                >
                  {option.label ? `${option.label} (${option.email})` : option.email}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
