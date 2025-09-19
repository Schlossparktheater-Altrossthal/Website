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

const magicSchema = z.object({ email: z.string().email() });
const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Mindestens 6 Zeichen"),
});

export default function LoginPage() {
  // Use only NEXT_PUBLIC_ var to keep SSR/CSR consistent and avoid hydration mismatches
  const devNoDb = process.env.NEXT_PUBLIC_AUTH_DEV_NO_DB === "1";
  const [loading, setLoading] = useState(false);
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
    if (err) {
      const map: Record<string, string> = {
        OAuthAccountNotLinked: "Account nicht verknüpft",
        CredentialsSignin: "Ungültige Zugangsdaten",
        AccessDenied: "Zugriff verweigert",
        default: "Login fehlgeschlagen",
      };
      toast.error(map[err] ?? map.default);
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
      } else {
        toast.success("Erfolgreich angemeldet");
        if (res?.url) router.push(res.url);
        else router.push("/mitglieder");
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

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <h1 className="font-serif text-3xl">Login</h1>

      {!devNoDb && (
        <form onSubmit={magicForm.handleSubmit(onMagicSubmit)} className="space-y-3" aria-label="Magic Link Login">
          <label className="block text-sm">
            <span>E-Mail</span>
            <Input type="email" placeholder="du@example.com" {...magicForm.register("email")} aria-required />
          </label>
          <Button disabled={loading} type="submit">
            Magic Link senden
          </Button>
        </form>
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
  );
}
