import { z } from "zod";

export const REGISTRATION_DEADLINE_OPTION_VALUES = [
  "none",
  "12h",
  "24h",
  "48h",
  "72h",
  "1w",
  "2w",
] as const;

export type RegistrationDeadlineOption = (typeof REGISTRATION_DEADLINE_OPTION_VALUES)[number];

export const registrationDeadlineOptionSchema = z.enum(REGISTRATION_DEADLINE_OPTION_VALUES);

export const REGISTRATION_DEADLINE_OPTIONS: {
  value: RegistrationDeadlineOption;
  label: string;
}[] = [
  { value: "none", label: "Keine Rückmeldefrist" },
  { value: "12h", label: "12 Stunden vorher" },
  { value: "24h", label: "1 Tag vorher" },
  { value: "48h", label: "2 Tage vorher" },
  { value: "72h", label: "3 Tage vorher" },
  { value: "1w", label: "1 Woche vorher" },
  { value: "2w", label: "2 Wochen vorher" },
];

export const REGISTRATION_DEADLINE_OFFSETS: Record<RegistrationDeadlineOption, number | null> = {
  none: null,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
  "72h": 72 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "2w": 14 * 24 * 60 * 60 * 1000,
};

export function computeRegistrationDeadline(
  start: Date,
  option: RegistrationDeadlineOption,
): Date | null {
  const offset = REGISTRATION_DEADLINE_OFFSETS[option];
  if (!offset) {
    return null;
  }
  return new Date(start.getTime() - offset);
}
