export type MaybeString = string | null | undefined;
export function trimToNull(value: MaybeString): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function combineNameParts(firstName?: MaybeString, lastName?: MaybeString): string | null {
  const first = trimToNull(firstName);
  const last = trimToNull(lastName);
  if (!first && !last) return null;
  return [first, last].filter(Boolean).join(" ");
}

export function getUserFullName(user: {
  firstName?: MaybeString;
  lastName?: MaybeString;
  name?: MaybeString;
}): string | null {
  return combineNameParts(user.firstName, user.lastName) ?? trimToNull(user.name);
}

export function getUserDisplayName(
  user: {
    firstName?: MaybeString;
    lastName?: MaybeString;
    name?: MaybeString;
    email?: MaybeString;
  },
  fallback = "Unbekannt",
): string {
  return getUserFullName(user) ?? trimToNull(user.email) ?? fallback;
}

function initialsFromSegments(segments: string[]): string | null {
  if (segments.length === 0) return null;
  if (segments.length >= 2) {
    const first = Array.from(segments[0] ?? "").shift();
    const last = Array.from(segments[segments.length - 1] ?? "").shift();
    if (first && last) return `${first}${last}`.toUpperCase();
  }
  const joined = segments[0] ?? "";
  const letters = Array.from(joined).slice(0, 2).join("");
  return letters ? letters.toUpperCase() : null;
}

export function getNameInitials(params: {
  firstName?: MaybeString;
  lastName?: MaybeString;
  name?: MaybeString;
  email?: MaybeString;
}): string {
  const first = trimToNull(params.firstName);
  const last = trimToNull(params.lastName);
  const fromParts = initialsFromSegments([first, last].filter(Boolean) as string[]);
  if (fromParts) return fromParts;

  const fallbackName = trimToNull(params.name);
  if (fallbackName) {
    const nameInitials = initialsFromSegments(fallbackName.split(/\s+/).filter(Boolean));
    if (nameInitials) return nameInitials;
  }

  const trimmedEmail = trimToNull(params.email);
  if (trimmedEmail) {
    const local = trimmedEmail.split("@")[0];
    const emailInitials = initialsFromSegments([local].filter(Boolean));
    if (emailInitials) return emailInitials;
  }

  return "?";
}

export function splitFullName(fullName: MaybeString): { firstName: string | null; lastName: string | null } {
  const trimmed = trimToNull(fullName);
  if (!trimmed) return { firstName: null, lastName: null };

  if (trimmed.includes(",")) {
    const [lastPart, firstPart] = trimmed.split(",", 2);
    return {
      firstName: trimToNull(firstPart),
      lastName: trimToNull(lastPart),
    };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null };

  const [first, ...rest] = parts;
  return {
    firstName: first ?? null,
    lastName: rest.join(" ") || null,
  };
}
