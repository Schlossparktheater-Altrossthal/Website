/**
 * Schul-/Berufsangaben der Mitglieder. Das Berufliche Schulzentrum für Agrarwirtschaft und
 * Ernährung Dresden hat zwei Standorte, die wir sicher unterscheiden müssen:
 * Altroßthal 1 (grüne Berufe) und Canalettostraße 8 (Ernährungsberufe).
 * Quelle: https://bsz-ae-dd.de/ und Sächsische Schuldatenbank (Stand 2026-09).
 *
 * Client- und serverseitig nutzbar (keine Prisma-Importe).
 */

export const BSZ_SCHOOL_NAME = "BSZ für Agrarwirtschaft und Ernährung Dresden";

export const BSZ_CAMPUSES = [
  {
    id: "altrossthal",
    label: "BSZ Altroßthal",
    detail: "Altroßthal 1 · grüne Berufe",
    schoolName: `${BSZ_SCHOOL_NAME} – Standort Altroßthal`,
  },
  {
    id: "canaletto",
    label: "BSZ Canalettostraße",
    detail: "Canalettostraße 8 · Ernährungsberufe",
    schoolName: `${BSZ_SCHOOL_NAME} – Standort Canalettostraße`,
  },
] as const;

export type BszCampusId = (typeof BSZ_CAMPUSES)[number]["id"];

export const EDUCATION_CATEGORIES = [
  { value: "school", label: "Schule" },
  { value: "work", label: "Ausbildung / Beruf" },
  { value: "university", label: "Studium" },
  { value: "other", label: "Anderes" },
] as const;

export type EducationKind = (typeof EDUCATION_CATEGORIES)[number]["value"];

/** Gespeicherte Kategorie (`MemberOnboardingProfile.educationCategory`). */
export type StoredEducationCategory =
  "school_bsz" | "school_other" | "work" | "university" | "other";

/** Formularzustand; `school` = BSZ-Standort (`campus`) oder andere Schule (`campus: "other"`). */
export type EducationValue = {
  kind: EducationKind | "";
  campus: BszCampusId | "other" | null;
  schoolName: string;
  className: string;
  workDescription: string;
  universityName: string;
  otherDescription: string;
};

export const EMPTY_EDUCATION: EducationValue = {
  kind: "",
  campus: null,
  schoolName: "",
  className: "",
  workDescription: "",
  universityName: "",
  otherDescription: "",
};

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").toLowerCase();
}

/** Erkennt den BSZ-Standort in Freitext (auch alte Angaben wie „BSZ Canaletto“). */
export function resolveBszCampus(text: string | null | undefined): BszCampusId | null {
  if (!text) return null;
  const normalized = normalize(text);
  if (normalized.includes("canaletto")) return "canaletto";
  if (normalized.includes("altrossthal") || normalized.includes("altrothal")) return "altrossthal";
  return null;
}

export function getBszCampus(id: BszCampusId) {
  return BSZ_CAMPUSES.find((campus) => campus.id === id) ?? BSZ_CAMPUSES[0];
}

type StoredEducation = {
  educationCategory?: string | null;
  educationSchoolName?: string | null;
  educationClassName?: string | null;
  educationWorkDescription?: string | null;
  educationUniversityName?: string | null;
  educationOtherDescription?: string | null;
  /** Alte Freitext-Angabe aus dem Profil (Fallback). */
  background?: string | null;
  backgroundClass?: string | null;
};

/** Baut den Formularzustand aus gespeicherten Feldern (inkl. alter Freitext-Angaben). */
export function readStoredEducation(stored: StoredEducation | null | undefined): EducationValue {
  if (!stored) return EMPTY_EDUCATION;
  const base = { ...EMPTY_EDUCATION };
  switch (stored.educationCategory) {
    case "school_bsz":
    case "school_other": {
      const campus = resolveBszCampus(stored.educationSchoolName);
      return {
        ...base,
        kind: "school",
        campus: campus ?? (stored.educationCategory === "school_other" ? "other" : null),
        schoolName: campus ? "" : (stored.educationSchoolName ?? ""),
        className: stored.educationClassName ?? "",
      };
    }
    case "work":
      return { ...base, kind: "work", workDescription: stored.educationWorkDescription ?? "" };
    case "university":
      return { ...base, kind: "university", universityName: stored.educationUniversityName ?? "" };
    case "other":
      return { ...base, kind: "other", otherDescription: stored.educationOtherDescription ?? "" };
  }
  const legacy = stored.background?.trim();
  if (!legacy) return base;
  const campus = resolveBszCampus(legacy);
  if (campus) {
    return { ...base, kind: "school", campus, className: stored.backgroundClass ?? "" };
  }
  return { ...base, kind: "other", otherDescription: legacy };
}

export type EducationPayload = {
  educationCategory: StoredEducationCategory | null;
  educationSchoolName: string | null;
  educationClassName: string | null;
  educationWorkDescription: string | null;
  educationUniversityName: string | null;
  educationOtherDescription: string | null;
};

const trimmedOrNull = (value: string) => value.trim() || null;

export function toEducationPayload(value: EducationValue): EducationPayload {
  const payload: EducationPayload = {
    educationCategory: null,
    educationSchoolName: null,
    educationClassName: null,
    educationWorkDescription: null,
    educationUniversityName: null,
    educationOtherDescription: null,
  };
  switch (value.kind) {
    case "school":
      if (value.campus === "other") {
        return {
          ...payload,
          educationCategory: "school_other",
          educationSchoolName: trimmedOrNull(value.schoolName),
          educationClassName: trimmedOrNull(value.className),
        };
      }
      if (value.campus) {
        return {
          ...payload,
          educationCategory: "school_bsz",
          educationSchoolName: getBszCampus(value.campus).schoolName,
          educationClassName: trimmedOrNull(value.className),
        };
      }
      return payload;
    case "work":
      return {
        ...payload,
        educationCategory: "work",
        educationWorkDescription: trimmedOrNull(value.workDescription),
      };
    case "university":
      return {
        ...payload,
        educationCategory: "university",
        educationUniversityName: trimmedOrNull(value.universityName),
      };
    case "other":
      return {
        ...payload,
        educationCategory: "other",
        educationOtherDescription: trimmedOrNull(value.otherDescription),
      };
    default:
      return payload;
  }
}

/** Pflichtangaben prüfen; gibt eine Fehlermeldung oder `null` zurück. */
export function validateEducation(value: EducationValue): string | null {
  if (!value.kind) return "Bitte wähle Schule, Ausbildung/Beruf, Studium oder Anderes aus.";
  if (value.kind === "school") {
    if (!value.campus) return "Bitte wähle aus, an welche Schule du gehst.";
    if (value.campus === "other" && !value.schoolName.trim()) {
      return "Bitte gib den Namen deiner Schule an.";
    }
    if (value.campus !== "other" && !value.className.trim()) {
      return "Bitte gib deine Klasse an.";
    }
  }
  return null;
}

/** Kurzfassung für Übersichten, z. B. „BSZ Altroßthal · Klasse BG 12“. */
export function formatEducation(stored: StoredEducation | null | undefined): string | null {
  const value = readStoredEducation(stored);
  const legacy = legacyBackgroundFromPayload(toEducationPayload(value));
  if (!legacy.background) return null;
  return legacy.backgroundClass
    ? `${legacy.background} · Klasse ${legacy.backgroundClass}`
    : legacy.background;
}

/**
 * Alte Felder `background`/`backgroundClass` weiter befüllen – Onboarding-Dashboard und
 * Auswertungen lesen sie noch.
 */
export function legacyBackgroundFromPayload(payload: EducationPayload): {
  background: string | null;
  backgroundClass: string | null;
} {
  switch (payload.educationCategory) {
    case "school_bsz": {
      const campus = resolveBszCampus(payload.educationSchoolName);
      return {
        background: campus ? getBszCampus(campus).label : payload.educationSchoolName,
        backgroundClass: payload.educationClassName,
      };
    }
    case "school_other":
      return {
        background: payload.educationSchoolName ?? "Schule",
        backgroundClass: payload.educationClassName,
      };
    case "work":
      return { background: payload.educationWorkDescription ?? "Beruf", backgroundClass: null };
    case "university":
      return { background: payload.educationUniversityName ?? "Studium", backgroundClass: null };
    case "other":
      return { background: payload.educationOtherDescription ?? "Anderes", backgroundClass: null };
    default:
      return { background: null, backgroundClass: null };
  }
}
