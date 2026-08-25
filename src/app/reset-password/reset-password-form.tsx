"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validate = () => {
    if (password.length < 8 || confirmPassword.length < 8) {
      return "Beide Passwörter müssen mindestens 8 Zeichen lang sein.";
    }
    if (password !== confirmPassword) {
      return "Die Passwörter stimmen nicht überein.";
    }
    return null;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    setError(validationError);
    if (validationError) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.redirected) {
        router.push(response.url);
        return;
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Passwort konnte nicht gespeichert werden.");
      }

      toast.success("Passwort erfolgreich gespeichert.");
      router.push("/mitglieder");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Passwort konnte nicht gespeichert werden.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block space-y-2 text-sm text-foreground">
        <span>Neues Passwort</span>
        <PasswordInput
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label className="block space-y-2 text-sm text-foreground">
        <span>Passwort bestätigen</span>
        <PasswordInput
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Speichern…" : "Passwort speichern"}
      </Button>
    </form>
  );
}
