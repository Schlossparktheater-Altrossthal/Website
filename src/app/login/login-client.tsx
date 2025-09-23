"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, type SignInResponse } from "next-auth/react";
import { Input } from "@/components/ui/input";
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
import { MailCheck } from "lucide-react";

const magicSchema = z.object({ email: z.string().email() });
const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Mindestens 6 Zeichen"),
});

export function LoginPageClient() {
  // Use only NEXT_PUBLIC_ var to keep SSR/CSR consistent and avoid hydration mismatches
  const devNoDb = process.env.NEXT_PUBLIC_AUTH_DEV_NO_DB === "1";
  const [loading, setLoading] = useState(false);
  const [magicDialogOpen, setMagicDialogOpen] = useState(false);
  const [showMagicSuggestion, setShowMagicSuggestion] = useState(false);
  const magicForm = useForm<z.infer<typeof magicSchema>>({
    resolver: zodResolver(magicSchema),
    defaultValues: { email: "" },
  });
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: "", password: "" },
  });
  const router = useRouter();
  const sp = useSearchParams();

  // Surface NextAuth error from ?error=...
  useEffect(() => {
    const err = sp?.get("error");
    const reason = sp?.get("reason");
    if (err) {
      if (err === "AccessDenied" && reason === "deactivated") {
        toast.error("Dieses Konto wurde deaktiviert. Bitte kontaktiere die Administration.");
        setShowMagicSuggestion(false);
        return;
      }
      const map: Record<string, string> = {
        OAuthAccountNotLinked: "Account nicht verknüpft",
        CredentialsSignin: "Ungültige Zugangsdaten",
        AccessDenied: "Zugriff verweigert",
        default: "Login fehlgeschlagen",
      };
      toast.error(map[err] ?? map.default);
      setShowMagicSuggestion(err === "CredentialsSignin");
    }
  }, [sp]);

  async function onMagicSubmit(values: z.infer<typeof magicSchema>) {
    setLoading(true);
    try {
      const res: SignInResponse | undefined = await signIn("email", {
        email: values.email,
        redirect: false,
        callbackUrl: "/mitglieder",
      });
      if (res?.error) {
        toast.error(res.error || "E-Mail Versand fehlgeschlagen");
      } else {
        toast.success("Magic Link gesendet – bitte E-Mail prüfen.");
        setMagicDialogOpen(false);
      }
    } catch {
      toast.error("Login fehlgeschlagen");
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
        callbackUrl: "/mitglieder",
      });
      if (res?.error) {
        toast.error(res.error || "Anmeldung fehlgeschlagen");
        setShowMagicSuggestion(true);
        magicForm.setValue("email", values.email);
      } else {
        toast.success("Erfolgreich angemeldet");
        setShowMagicSuggestion(false);
        if (res?.url) router.push(res.url);
        else router.push("/mitglieder");
      }
    } catch {
      toast.error("Login fehlgeschlagen");
      setShowMagicSuggestion(true);
      magicForm.setValue("email", values.email);
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

  const handleOpenMagic = () => {
    if (devNoDb) return;
    const emailFromPassword = passwordForm.getValues("email");
    if (emailFromPassword) {
      magicForm.setValue("email", emailFromPassword);
    }
  };

  return (
    <Dialog open={magicDialogOpen} onOpenChange={setMagicDialogOpen}>
      <div className="max-w-sm mx-auto space-y-6">
        <h1 className="font-serif text-3xl">Login</h1>

        {!devNoDb && (
          <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-muted/70 via-muted/40 to-transparent p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MailCheck className="h-5 w-5" aria-hidden />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Kein Passwort zur Hand?</p>
                  <p className="text-sm text-muted-foreground">
                    Lass dir einen einmaligen Login-Link an deine E-Mail senden.
                  </p>
                </div>
              </div>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="secondary" onClick={handleOpenMagic}>
                  Magic Link
                </Button>
              </DialogTrigger>
            </div>
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
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...passwordForm.register("password")}
                aria-required
              />
            </label>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Wird geprüft…" : "Anmelden"}
          </Button>
        </form>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login-Link anfordern</DialogTitle>
            <DialogDescription>
              Wir senden dir einen einmaligen Login-Link an deine E-Mail-Adresse. Der Link ist nur kurze Zeit gültig.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={magicForm.handleSubmit(onMagicSubmit)}
            className="space-y-4"
            aria-label="Login per E-Mail Link"
          >
            <Input
              type="email"
              placeholder="du@example.com"
              autoComplete="email"
              {...magicForm.register("email")}
              aria-required
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setMagicDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Senden…" : "Login-Link schicken"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>

        {showMagicSuggestion && !devNoDb && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm text-primary">
            <p className="font-semibold">Passwort vergessen?</p>
            <p className="mt-1">
              Versuch es mit einem einmaligen Login-Link. Wir schicken dir eine E-Mail an {magicForm.getValues("email") || "deine Adresse"}.
            </p>
          </div>
        )}

        {process.env.NEXT_PUBLIC_AUTH_DEV_TEST_USERS && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Test-Logins</p>
            <p>Nur in der lokalen Entwicklungsumgebung verfügbar.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {process.env.NEXT_PUBLIC_AUTH_DEV_TEST_USERS.split(",").map((email) => (
                <Button
                  key={email}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => testLogin(email)}
                  disabled={loading}
                >
                  {email}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
