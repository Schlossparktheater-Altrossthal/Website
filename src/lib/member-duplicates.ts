export type DuplicateCandidateUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
  dateOfBirth: Date | null;
  deactivatedAt: Date | null;
};

export type DuplicateGroup = { reason: string; users: DuplicateCandidateUser[] };

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

function fullName(user: DuplicateCandidateUser): string {
  const combined = normalize(`${user.firstName ?? ""}${user.lastName ?? ""}`);
  return combined || normalize(user.name);
}

/** Lokaler Teil der E-Mail ohne Punkte und „+Zusatz“ (typisch für Zweitadressen). */
function emailKey(email: string | null): string {
  if (!email) return "";
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  const base = local.split("+")[0].replace(/\./g, "");
  return domain === "gmail.com" || domain === "googlemail.com"
    ? `${base}@gmail`
    : `${base}@${domain}`;
}

/**
 * Findet mögliche Doppel-Konten derselben Person: gleicher Name, gleicher Nachname mit
 * gleichem Geburtsdatum oder praktisch gleiche E-Mail-Adresse. Anonymisierte Konten zählen nicht.
 */
export function findPossibleDuplicates(users: readonly DuplicateCandidateUser[]): DuplicateGroup[] {
  const rules: Array<{ reason: string; key: (user: DuplicateCandidateUser) => string }> = [
    { reason: "Gleicher Name", key: fullName },
    {
      reason: "Gleicher Nachname und Geburtsdatum",
      key: (user) =>
        user.dateOfBirth && normalize(user.lastName)
          ? `${normalize(user.lastName)}|${user.dateOfBirth.toISOString().slice(0, 10)}`
          : "",
    },
    { reason: "Fast gleiche E-Mail-Adresse", key: (user) => emailKey(user.email) },
  ];

  const seenPairs = new Set<string>();
  const groups: DuplicateGroup[] = [];
  for (const rule of rules) {
    const buckets = new Map<string, DuplicateCandidateUser[]>();
    for (const user of users) {
      const key = rule.key(user);
      if (!key) continue;
      buckets.set(key, [...(buckets.get(key) ?? []), user]);
    }
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue;
      const pairKey = bucket
        .map((user) => user.id)
        .sort()
        .join("|");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      groups.push({ reason: rule.reason, users: bucket });
    }
  }
  return groups;
}
