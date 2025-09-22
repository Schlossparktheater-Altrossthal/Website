"use client";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, type SignInResponse } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Suspense, useEffect, useState } from "react";
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
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
                placeholder="Passwort"
                autoComplete="current-password"
                {...passwordForm.register("password")}
                aria-required
              />
            </label>
          </div>
          <Button disabled={loading} type="submit">
            Mit Passwort einloggen
          </Button>
        </form>

        {showMagicSuggestion && !devNoDb && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 shadow-sm">
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-destructive">Passwort stimmt nicht?</p>
              <p className="text-muted-foreground">
                Lass dir stattdessen einen sicheren Login-Link senden.
              </p>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-0 text-sm font-medium text-destructive hover:bg-transparent hover:text-destructive/80"
                  onClick={handleOpenMagic}
                >
                  Magic Link anfordern
                </Button>
              </DialogTrigger>
            </div>
          </div>
        )}

        {process.env.NODE_ENV !== "production" && (
          <div className="space-y-2">
            <div className="text-sm opacity-75">
              Dev: Schnell-Login{devNoDb ? " (ohne DB)" : ""}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["member", "cast", "tech", "board", "finance", "admin", "owner"].map((r) => (
                <Button key={r} variant="outline" onClick={() => testLogin(`${r}@example.com`)}>
                  {r}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!devNoDb && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-1">
            <DialogTitle>Magic Link anfordern</DialogTitle>
            <DialogDescription>
              Wir senden dir einen einmaligen Login-Link per E-Mail – gültig für wenige Minuten.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={magicForm.handleSubmit(onMagicSubmit)}
            className="space-y-4"
            aria-label="Magic Link Login"
          >
            <label className="block text-sm">
              <span>E-Mail</span>
              <Input
                type="email"
                placeholder="du@example.com"
                autoComplete="email"
                {...magicForm.register("email")}
                aria-required
              />
            </label>
            <DialogFooter>
              <Button disabled={loading} type="submit" className="w-full sm:w-auto">
                Magic Link senden
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
