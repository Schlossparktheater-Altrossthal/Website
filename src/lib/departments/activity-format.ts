import type { TaskActivityType } from "@prisma/client";

/** „Ich bin dran“ gilt so lange, danach ist die Karte wieder frei. */
export const CLAIM_HOURS = 12;

export function claimActive(claimedAt: Date | string | null | undefined, now = new Date()) {
  if (!claimedAt) return false;
  return now.getTime() - new Date(claimedAt).getTime() < CLAIM_HOURS * 60 * 60 * 1000;
}

export const NOTE_LIMIT = 500;

/** Kurzfassung einer Notiz von Person + Zeitpunkt. */
export type NoteState = { text: string; by: string | null; at: string };

export type ClaimState = { userId: string; name: string; at: string };

/** Stand einer Karte für die Übergabe (docs/Plan/uebergabe-plan.md). */
export type HandoverState = {
  nextStep: NoteState | null;
  caution: NoteState | null;
  claim: ClaimState | null;
};

export type ActivityEntry = {
  id: string;
  type: TaskActivityType;
  actor: string | null;
  text: string;
  at: string;
};

type Data = Record<string, unknown> | null | undefined;

const str = (data: Data, key: string) => {
  const value = data?.[key];
  return typeof value === "string" && value ? value : null;
};

/** Ein Verlaufseintrag als Satz ohne Person, z. B. „hat „grundiert“ abgehakt“. */
export function describeActivity(type: TaskActivityType, data: Data): string {
  const text = str(data, "text");
  const to = str(data, "to");
  switch (type) {
    case "created":
      return "hat die Karte angelegt";
    case "column":
      return to ? `hat sie nach „${to}“ geschoben` : "hat die Karte verschoben";
    case "status":
      return to ? `Status: ${to}` : "hat den Status geändert";
    case "checklist_added":
      return `Schritt ergänzt: „${text ?? ""}“`;
    case "checklist_done":
      return `hat „${text ?? ""}“ abgehakt`;
    case "checklist_undone":
      return `„${text ?? ""}“ wieder offen`;
    case "comment":
      return `Kommentar: ${text ?? ""}`;
    case "next_step":
      return text ? `Nächster Schritt: ${text}` : "Nächster Schritt entfernt";
    case "caution":
      return text ? `⚠ Achtung: ${text}` : "Achtung-Hinweis entfernt";
    case "claim":
      return data?.on ? "ist jetzt dran" : "hat die Karte freigegeben";
    case "photo":
      return "hat ein Foto hinzugefügt";
    case "source":
      return to ? `Herkunft: ${to}` : "hat die Herkunft geändert";
  }
}
