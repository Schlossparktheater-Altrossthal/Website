"use client";

import { useState } from "react";
import { AlertTriangle, BellRing } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TestMode = "normal" | "emergency";

export interface MemberTestNotificationCardProps {
  userId: string;
  displayName: string;
  hasEmail: boolean;
}

export function MemberTestNotificationCard({
  userId,
  displayName,
  hasEmail,
}: MemberTestNotificationCardProps) {
  const [pending, setPending] = useState<TestMode | null>(null);

  const sendTestNotification = async (mode: TestMode) => {
    if (pending) return;
    setPending(mode);
    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mode }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        const message = payload?.error || "Testbenachrichtigung konnte nicht gesendet werden.";
        toast.error(message);
        return;
      }
      toast.success(
        mode === "emergency"
          ? `Notfall-Testbenachrichtigung an ${displayName} gesendet.`
          : `Testbenachrichtigung an ${displayName} gesendet.`,
      );
    } catch (error) {
      console.error("[MemberTestNotificationCard] send failed", error);
      toast.error("Testbenachrichtigung konnte nicht gesendet werden.");
    } finally {
      setPending(null);
    }
  };

  return (
    <Card className="border border-border/70">
      <CardHeader className="space-y-1.5">
        <CardTitle>Testbenachrichtigungen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sende eine normale oder Notfall-Testnachricht an {displayName}, um Zustellung und Geräte zu prüfen.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasEmail ? (
          <p className="text-xs text-muted-foreground">
            Es ist keine E-Mail-Adresse hinterlegt. Testbenachrichtigungen erscheinen trotzdem im Portal dieses Mitglieds.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            className="justify-start gap-2"
            disabled={Boolean(pending)}
            onClick={() => sendTestNotification("normal")}
          >
            <BellRing className="h-4 w-4" aria-hidden />
            {pending === "normal" ? "Sende…" : "Normale Testbenachrichtigung"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="justify-start gap-2"
            disabled={Boolean(pending)}
            onClick={() => sendTestNotification("emergency")}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {pending === "emergency" ? "Sende…" : "Notfall-Testbenachrichtigung"}
          </Button>
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          Beide Varianten erzeugen echte Portal-Benachrichtigungen für {displayName}, wirken sich aber sonst nicht auf Planungen aus.
        </p>
      </CardContent>
    </Card>
  );
}
