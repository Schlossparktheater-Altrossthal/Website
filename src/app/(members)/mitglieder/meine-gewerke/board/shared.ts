import type { TaskPriority } from "@prisma/client";

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "Hoch",
  normal: "Normal",
  low: "Niedrig",
};

export type ActionResult = { ok: boolean; error?: string };

/** `YYYY-MM-DD` für `<input type="date">`, aus ISO-String in lokaler Zeit. */
export function toDateInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
