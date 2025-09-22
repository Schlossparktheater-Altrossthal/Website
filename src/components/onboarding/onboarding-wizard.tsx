"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AllergyLevel, type Role } from "@prisma/client";
import { Sparkles, ShieldCheck, Lock, Target } from "lucide-react";
import { toast } from "sonner";

import { SignaturePad } from "@/components/onboarding/signature-pad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const allergyLevelLabels: Record<AllergyLevel, string> = {
  MILD: "Leicht (Unbehagen)",
  MODERATE: "Mittel (Reaktion möglich)",
  SEVERE: "Stark (ärztliche Hilfe)",
  LETHAL: "Kritisch (Notfall)",
};

const actingOptions = [
  {
    code: "acting_statist",
    title: "Statistenrolle",
    description: "Auf der Bühne ohne Text – Präsenz in Bildern und Szenen.",
  },
  {
    code: "acting_scout",
    title: "Schnupperrolle",
    description: "Kleine Auftritte zum Reinschnuppern mit überschaubarer Textmenge.",
  },
  {
    code: "acting_medium",
    title: "Mittlere Rolle",
    description: "Spürbar auf der Bühne, mit Verantwortung im Ensemble und regelmäßigem Proben.",
  },
  {
    code: "acting_lead",
    title: "Große Rolle",
    description: "Haupt- oder zentrale Nebenrolle mit intensiver Vorbereitung und Bühnenpräsenz.",
  },
];

const crewOptions = [
  {
    code: "crew_stage",
    title: "Bühnenbild & Ausstattung",
    description: "Räume entwerfen, Kulissen bauen und für beeindruckende Bilder sorgen.",
  },
  {
    code: "crew_tech",
    title: "Licht & Ton",
    description: "Shows inszenieren mit Licht, Klang, Effekten und technischer Präzision.",
  },
  {
    code: "crew_costume",
    title: "Kostüm",
    description: "Looks entwickeln, nähen, Fundus pflegen und Outfits anpassen.",
  },
  {
    code: "crew_makeup",
    title: "Maske & Make-up",
    description: "Maskenbild, Styling, Perücken und schnelle Verwandlungen hinter der Bühne.",
  },
  {
    code: "crew_direction",
    title: "Regieassistenz & Orga",
    description: "Abläufe koordinieren, Proben strukturieren, Teams im Hintergrund führen.",
  },
  {
    code: "crew_music",
    title: "Musik & Klang",
    description: "Arrangements entwickeln, Proben begleiten und Produktionen musikalisch tragen.",
  },
  {
    code: "crew_props",
    title: "Requisite",
    description: "Requisiten gestalten, organisieren und für reibungslose Szenen sorgen.",
  },
  {
    code: "crew_marketing",
    title: "Werbung & Social Media",
    description: "Kampagnen planen, Content erstellen und unsere Produktionen sichtbar machen.",
  },
];

const genderOptions = [
  { value: "female", label: "Weiblich" },
  { value: "male", label: "Männlich" },
  { value: "diverse", label: "Divers" },
  { value: "no_answer", label: "Keine Angabe" },
  { value: "custom", label: "Selbst beschreiben" },
] as const;

type GenderOption = (typeof genderOptions)[number]["value"];

const dietaryStyleOptions = [
  { value: "none", label: "Keine besondere Ernährung" },
  { value: "omnivore", label: "Allesesser:in" },
  { value: "vegetarian", label: "Vegetarisch" },
  { value: "vegan", label: "Vegan" },
  { value: "pescetarian", label: "Pescetarisch" },
  { value: "flexitarian", label: "Flexitarisch" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Koscher" },
  { value: "custom", label: "Anderes (bitte angeben)" },
] as const;

type DietaryStyleOption = (typeof dietaryStyleOptions)[number]["value"];

const dietaryStrictnessOptions = [
  { value: "strict", label: "Strikt – keine Ausnahmen" },
  { value: "flexible", label: "Flexibel – kleine Ausnahmen sind möglich" },
  { value: "situational", label: "Situationsabhängig / nach Rücksprache" },
] as const;

type DietaryStrictnessOption = (typeof dietaryStrictnessOptions)[number]["value"];

const CURRENT_YEAR = new Date().getFullYear();

const BASE_BACKGROUND_SUGGESTIONS = ["Schule", "Berufsschule", "Universität", "Ausbildung", "Beruf"] as const;

const allergyLevelStyles: Record<AllergyLevel, { badge: string; accent: string }> = {
  MILD: {
    badge: "border-emerald-400/50 bg-emerald-50 text-emerald-700",
    accent: "from-emerald-400/70 to-emerald-500/70",
  },
  MODERATE: {
    badge: "border-amber-400/50 bg-amber-50 text-amber-800",
    accent: "from-amber-400/70 to-orange-400/70",
  },
  SEVERE: {
    badge: "border-rose-400/50 bg-rose-50 text-rose-800",
    accent: "from-rose-400/70 to-rose-500/70",
  },
  LETHAL: {
    badge: "border-red-500/60 bg-red-50 text-red-800",
    accent: "from-red-500/80 to-red-600/80",
  },
};

const allergyLevelIntensity: Record<AllergyLevel, number> = {
  MILD: 35,
  MODERATE: 55,
  SEVERE: 75,
  LETHAL: 95,
};

const weightLabels: { threshold: number; label: string }[] = [
  { threshold: 0, label: "Nur mal reinschauen" },
  { threshold: 25, label: "Locker interessiert" },
  { threshold: 50, label: "Motiviert" },
  { threshold: 75, label: "Sehr engagiert" },
  { threshold: 90, label: "Herzensprojekt" },
];

const focusLabels: Record<"acting" | "tech" | "both", string> = {
  acting: "Schauspiel",
  tech: "Gewerke",
  both: "Schauspiel & Gewerke",
};

const focusDescriptions: Record<"acting" | "tech" | "both", string> = {
  acting: "Du möchtest auf der Bühne wirken und Rollen gestalten.",
  tech: "Du möchtest hinter den Kulissen organisieren, bauen oder für Licht & Ton sorgen.",
  both: "Du bleibst flexibel zwischen Bühne und Gewerken und entscheidest situativ.",
};

const focusBadgeStyles: Record<"acting" | "tech" | "both", string> = {
  acting: "border-violet-400/40 bg-violet-500/10 text-violet-600",
  tech: "border-cyan-400/40 bg-cyan-500/10 text-cyan-600",
  both: "border-indigo-400/40 bg-indigo-500/10 text-indigo-600",
};

const preferenceAccent: Record<"acting" | "crew", string> = {
  acting: "from-violet-500/70 to-fuchsia-500/70",
  crew: "from-cyan-500/70 to-teal-500/70",
};

const focusDomainMap = {
  acting: ["acting"],
  tech: ["crew"],
  both: ["acting", "crew"],
} as const satisfies Record<"acting" | "tech" | "both", readonly ("acting" | "crew")[]>;

const steps = [
  { title: "Willkommen" },
  { title: "Profil" },
  { title: "Fokus" },
  { title: "Interessen" },
  { title: "Fotos" },
  { title: "Essen" },
  { title: "Hinweise" },
  { title: "Check" },
];

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);

type PreferenceEntry = {
  code: string;
  title: string;
  description: string;
  weight: number;
  enabled: boolean;
  domain: "acting" | "crew";
  isCustom?: boolean;
};

type PreferenceSummaryEntry = {
  code: string;
  title: string;
  weight: number;
  label: string;
  isCustom: boolean;
  domain: "acting" | "crew";
};

type InterestSuggestion = {
  name: string;
  usage: number;
};

type DietaryEntry = {
  id: string;
  allergen: string;
  level: AllergyLevel;
  symptoms: string;
  treatment: string;
  note: string;
};

type InviteMeta = {
  label: string | null;
  note: string | null;
  roles: Role[];
  createdAt: string;
  createdBy: string | null;
  expiresAt: string | null;
  usageCount: number;
  remainingUses: number | null;
};

type OnboardingWizardProps = {
  sessionToken: string;
  invite: InviteMeta;
};

const initialActingPreferences: PreferenceEntry[] = actingOptions.map((option) => ({
  ...option,
  domain: "acting",
  enabled: option.code === "acting_medium",
  weight: option.code === "acting_medium" ? 60 : 40,
}));

const initialCrewPreferences: PreferenceEntry[] = crewOptions.map((option) => ({
  ...option,
  domain: "crew",
  enabled: false,
  weight: 50,
}));

function calculateAge(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age;
}

function createDietaryId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function createPreferenceCode() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `custom-${crypto.randomUUID()}`;
  }
  return `custom-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

function requiresBszClass(value: string) {
  if (!value) return false;
  const normalized = normalizeForMatch(value);
  if (!normalized.includes("bsz")) return false;
  return ["altrossthal", "altrothal", "canaletto"].some((keyword) => normalized.includes(keyword));
}

export function OnboardingWizard({ sessionToken, invite }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentMode, setDocumentMode] = useState<"upload" | "signature">("upload");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [availableInterests, setAvailableInterests] = useState<InterestSuggestion[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [backgroundSuggestions, setBackgroundSuggestions] = useState<string[]>(
    () => [...BASE_BACKGROUND_SUGGESTIONS],
  );
  const [customCrewDraft, setCustomCrewDraft] = useState({ title: "", description: "" });
  const [customCrewError, setCustomCrewError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    passwordConfirm: "",
    background: "",
    backgroundClass: "",
    notes: "",
    dateOfBirth: "",
    genderOption: "no_answer" as GenderOption,
    genderCustom: "",
    memberSinceYear: "",
    focus: "acting" as "acting" | "tech" | "both",
    actingPreferences: initialActingPreferences,
    crewPreferences: initialCrewPreferences,
    interests: [] as string[],
    nutritionStyle: "none" as DietaryStyleOption,
    nutritionCustomStyle: "",
    nutritionStrictness: "flexible" as DietaryStrictnessOption,
    photoConsent: { consent: true },
    dietary: [] as DietaryEntry[],
  });

  const [newInterest, setNewInterest] = useState("");
  const [dietaryDraft, setDietaryDraft] = useState({
    allergen: "",
    level: "MILD" as AllergyLevel,
    symptoms: "",
    treatment: "",
    note: "",
  });

  const notesHelpId = useId();

  useEffect(() => {
    let cancelled = false;
    const loadInterests = async () => {
      setInterestsLoading(true);
      try {
        const response = await fetch("/api/onboarding/interests", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!cancelled && Array.isArray(data?.interests)) {
          const entries = data.interests
            .map((entry: unknown): InterestSuggestion | null => {
              if (typeof entry === "string") {
                return { name: entry, usage: 0 } satisfies InterestSuggestion;
              }
              if (entry && typeof entry === "object") {
                const record = entry as { name?: unknown; usage?: unknown };
                const name = typeof record.name === "string" ? record.name : null;
                if (!name) return null;
                const usage = typeof record.usage === "number" && Number.isFinite(record.usage)
                  ? record.usage
                  : 0;
                return { name, usage } satisfies InterestSuggestion;
              }
              return null;
            })
            .filter(
              (entry: InterestSuggestion | null): entry is InterestSuggestion => Boolean(entry?.name),
            );
          setAvailableInterests(entries);
        }
      } catch {
        if (!cancelled) {
          setAvailableInterests([]);
        }
      } finally {
        if (!cancelled) setInterestsLoading(false);
      }
    };
    void loadInterests();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBackgrounds = async () => {
      try {
        const response = await fetch("/api/onboarding/backgrounds", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (cancelled || !Array.isArray(data?.backgrounds)) return;
        setBackgroundSuggestions((prev) => {
          const seen = new Set(prev.map((entry) => entry.toLowerCase()));
          const merged = [...prev];
          for (const rawEntry of data.backgrounds as unknown[]) {
            let label: string | null = null;
            if (typeof rawEntry === "string") {
              label = rawEntry;
            } else if (rawEntry && typeof rawEntry === "object") {
              const record = rawEntry as { name?: unknown };
              label = typeof record.name === "string" ? record.name : null;
            }
            if (!label) continue;
            const trimmed = label.trim();
            if (!trimmed) continue;
            const key = trimmed.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(trimmed);
          }
          return merged;
        });
      } catch {
        // ignore optional background suggestions errors
      }
    };
    void loadBackgrounds();
    return () => {
      cancelled = true;
    };
  }, []);

  const age = useMemo(() => calculateAge(form.dateOfBirth || null), [form.dateOfBirth]);
  const isMinor = age !== null && age < 18;
  const requiresBackgroundClass = useMemo(() => requiresBszClass(form.background), [form.background]);
  const backgroundClassLabel = useMemo(() => {
    const trimmed = form.backgroundClass.trim();
    return trimmed ? trimmed : null;
  }, [form.backgroundClass]);

  useEffect(() => {
    if (requiresBackgroundClass) return;
    if (!form.backgroundClass) return;
    setForm((prev) => {
      if (!prev.backgroundClass) return prev;
      return { ...prev, backgroundClass: "" };
    });
  }, [form.backgroundClass, requiresBackgroundClass]);

  const genderLabel = useMemo(() => {
    if (form.genderOption === "custom") {
      const custom = form.genderCustom.trim();
      return custom || "Selbst beschrieben";
    }
    const option = genderOptions.find((entry) => entry.value === form.genderOption);
    return option?.label ?? "Keine Angabe";
  }, [form.genderCustom, form.genderOption]);

  const memberSinceYearLabel = useMemo(() => {
    const trimmed = form.memberSinceYear.trim();
    if (!trimmed) return "Neu dabei";
    return trimmed;
  }, [form.memberSinceYear]);

  const nutritionStyleLabel = useMemo(() => {
    if (form.nutritionStyle === "custom") {
      const custom = form.nutritionCustomStyle.trim();
      return custom || "Individueller Stil";
    }
    const option = dietaryStyleOptions.find((entry) => entry.value === form.nutritionStyle);
    return option?.label ?? "Keine besondere Ernährung";
  }, [form.nutritionCustomStyle, form.nutritionStyle]);

  const nutritionStrictnessLabel = useMemo(() => {
    if (form.nutritionStyle === "none") {
      return "Nicht relevant";
    }
    const option = dietaryStrictnessOptions.find((entry) => entry.value === form.nutritionStrictness);
    return option?.label ?? "Flexibel – kleine Ausnahmen sind möglich";
  }, [form.nutritionStrictness, form.nutritionStyle]);

  const availableInterestSuggestions = useMemo(() => {
    const selected = new Set(form.interests.map((item) => item.toLowerCase()));
    return availableInterests
      .filter((interest) => interest.name && !selected.has(interest.name.toLowerCase()))
      .slice(0, 12);
  }, [availableInterests, form.interests]);

  const addInterestToForm = useCallback(
    (interest: string) => {
      const value = interest.trim();
      if (!value) return;
      setForm((prev) => {
        if (prev.interests.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
          return prev;
        }
        return { ...prev, interests: [...prev.interests, value] };
      });
    },
    [setForm],
  );

  const addInterest = useCallback(
    (interest: string) => {
      addInterestToForm(interest);
      setNewInterest("");
    },
    [addInterestToForm, setNewInterest],
  );

  const handleInterestInputChange = useCallback(
    (value: string) => {
      if (!value) {
        setNewInterest("");
        return;
      }

      if (!/[;,\n]/.test(value)) {
        setNewInterest(value);
        return;
      }

      const segments = value.split(/[,;\n]+/);
      const remainder = segments.pop() ?? "";
      segments.forEach((segment) => {
        const clean = segment.trim();
        if (clean) {
          addInterestToForm(clean);
        }
      });
      setNewInterest(remainder.replace(/^\s+/, ""));
    },
    [addInterestToForm, setNewInterest],
  );

  const removeInterest = useCallback((interest: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.filter((entry) => entry !== interest),
    }));
  }, []);

  const togglePreference = useCallback((domain: "acting" | "crew", code: string) => {
    setForm((prev) => {
      const key = domain === "acting" ? "actingPreferences" : "crewPreferences";
      const updated = prev[key].map((pref) =>
        pref.code === code ? { ...pref, enabled: !pref.enabled } : pref,
      );
      return { ...prev, [key]: updated };
    });
  }, []);

  const updatePreferenceWeight = useCallback((domain: "acting" | "crew", code: string, weight: number) => {
    if (!Number.isFinite(weight)) {
      return;
    }
    const normalizedWeight = Math.min(100, Math.max(0, Math.round(weight)));
    setForm((prev) => {
      const key = domain === "acting" ? "actingPreferences" : "crewPreferences";
      const updated = prev[key].map((pref) =>
        pref.code === code ? { ...pref, weight: normalizedWeight } : pref,
      );
      return { ...prev, [key]: updated };
    });
  }, []);

  const addCustomCrewPreference = useCallback(() => {
    setCustomCrewError(null);
    const title = customCrewDraft.title.trim();
    const description = customCrewDraft.description.trim();
    if (title.length < 2) {
      setCustomCrewError("Bitte gib deinem Gewerk einen Namen.");
      return;
    }
    let wasAdded = false;
    setForm((prev) => {
      const exists = prev.crewPreferences.some(
        (pref) => pref.title.trim().toLowerCase() === title.toLowerCase(),
      );
      if (exists) {
        setCustomCrewError("Dieses Gewerk hast du bereits markiert.");
        return prev;
      }
      wasAdded = true;
      return {
        ...prev,
        crewPreferences: [
          ...prev.crewPreferences,
          {
            code: createPreferenceCode(),
            title,
            description: description || "Individuelle Aufgabe im Team",
            weight: 60,
            enabled: true,
            domain: "crew",
            isCustom: true,
          },
        ],
      };
    });
    if (wasAdded) {
      setCustomCrewDraft({ title: "", description: "" });
    }
  }, [customCrewDraft.description, customCrewDraft.title]);

  const removeCustomCrewPreference = useCallback((code: string) => {
    setForm((prev) => ({
      ...prev,
      crewPreferences: prev.crewPreferences.filter((pref) => pref.code !== code),
    }));
  }, []);

  const preferenceSummary = useMemo(() => {
    const buildLabel = (entry: PreferenceEntry) => {
      const match = [...weightLabels].reverse().find((label) => entry.weight >= label.threshold);
      return match?.label ?? "Interesse";
    };
    const mapEntry = (entry: PreferenceEntry, domain: "acting" | "crew"): PreferenceSummaryEntry => ({
      code: entry.code,
      title: entry.title,
      weight: entry.weight,
      label: buildLabel(entry),
      isCustom: Boolean(entry.isCustom),
      domain,
    });
    const includesActing = form.focus === "acting" || form.focus === "both";
    const includesCrew = form.focus === "tech" || form.focus === "both";
    const acting = includesActing
      ? form.actingPreferences
          .filter((pref) => pref.enabled && pref.weight > 0)
          .map((pref) => mapEntry(pref, "acting"))
      : [];
    const crew = includesCrew
      ? form.crewPreferences
          .filter((pref) => pref.enabled && pref.weight > 0)
          .map((pref) => mapEntry(pref, "crew"))
      : [];
    return { acting, crew };
  }, [form.actingPreferences, form.crewPreferences, form.focus]);

  const preferenceStats = useMemo(() => {
    const compute = (entries: PreferenceSummaryEntry[]) => {
      if (!entries.length) {
        return { count: 0, average: 0 } as const;
      }
      const sum = entries.reduce((total, entry) => total + entry.weight, 0);
      return { count: entries.length, average: Math.round(sum / entries.length) } as const;
    };
    return {
      acting: compute(preferenceSummary.acting),
      crew: compute(preferenceSummary.crew),
    };
  }, [preferenceSummary]);

  const photoConsentMessage = useMemo(() => {
    if (!form.photoConsent.consent) {
      return "Bitte bestätige dein Einverständnis, damit wir dich auf Fotos zeigen dürfen.";
    }
    if (!documentFile) {
      return isMinor
        ? "Die unterschriebene Zustimmung deiner Erziehungsberechtigten fehlt noch."
        : "Bitte lade dein Einverständnis hoch oder unterschreibe digital.";
    }
    if (isMinor) {
      return "Einverständnis deiner Erziehungsberechtigten ist hinterlegt.";
    }
    if (documentMode === "signature") {
      return "Du hast die Fotoeinverständnis digital unterschrieben.";
    }
    return "Deine unterschriebene Fotoeinverständnis wird mitgeschickt.";
  }, [documentFile, documentMode, form.photoConsent.consent, isMinor]);

  const handleAddDietary = () => {
    const trimmed = dietaryDraft.allergen.trim();
    if (!trimmed) {
      setError("Bitte gib an, was du nicht verträgst.");
      return;
    }

    const normalized = trimmed.toLocaleLowerCase("de-DE");
    if (form.dietary.some((entry) => entry.allergen.trim().toLocaleLowerCase("de-DE") === normalized)) {
      setError("Dieses Allergen hast du bereits eingetragen.");
      return;
    }

    setError(null);
    setForm((prev) => ({
      ...prev,
      dietary: [
        ...prev.dietary,
        {
          id: createDietaryId(),
          allergen: trimmed,
          level: dietaryDraft.level,
          symptoms: dietaryDraft.symptoms.trim(),
          treatment: dietaryDraft.treatment.trim(),
          note: dietaryDraft.note.trim(),
        },
      ],
    }));
    setDietaryDraft({ allergen: "", level: "MILD", symptoms: "", treatment: "", note: "" });
  };

  const removeDietary = (id: string) => {
    setForm((prev) => ({
      ...prev,
      dietary: prev.dietary.filter((entry) => entry.id !== id),
    }));
  };

  const setDocumentFromFile = useCallback(
    (file: File | null) => {
      if (!file) {
        setDocumentFile(null);
        setDocumentError(null);
        return;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        setDocumentError("Dokument darf maximal 8 MB groß sein");
        setDocumentFile(null);
        return;
      }
      const type = file.type?.toLowerCase() ?? "";
      if (type && !ALLOWED_DOCUMENT_TYPES.has(type)) {
        setDocumentError("Bitte nutze PDF oder Bilddateien (JPG/PNG)");
        setDocumentFile(null);
        return;
      }
      setDocumentError(null);
      setDocumentFile(file);
    },
    [setDocumentError, setDocumentFile],
  );

  const handleDocumentInput = (file: File | null) => {
    if (documentMode !== "upload") {
      setDocumentMode("upload");
    }
    setSignatureDataUrl(null);
    setDocumentFromFile(file);
  };

  const handleSelectUploadMode = () => {
    if (documentMode === "upload") return;
    setDocumentMode("upload");
    setSignatureDataUrl(null);
    setDocumentFromFile(null);
  };

  const handleSelectSignatureMode = () => {
    if (isMinor || documentMode === "signature") return;
    setDocumentMode("signature");
    setSignatureDataUrl(null);
    setDocumentFromFile(null);
  };

  useEffect(() => {
    if (!isMinor) {
      return;
    }
    if (documentMode === "signature") {
      setDocumentMode("upload");
      setDocumentFromFile(null);
    }
    if (signatureDataUrl) {
      setSignatureDataUrl(null);
    }
  }, [documentMode, isMinor, setDocumentFromFile, signatureDataUrl]);

  const handleSignatureChange = (dataUrl: string | null) => {
    if (documentMode !== "signature") {
      setDocumentMode("signature");
    }
    setSignatureDataUrl(dataUrl);
  };

  useEffect(() => {
    if (!signatureDataUrl) {
      if (documentMode === "signature") {
        setDocumentFromFile(null);
        setDocumentError(null);
      }
      return;
    }
    const commaIndex = signatureDataUrl.indexOf(",");
    if (commaIndex === -1) {
      setDocumentError("Unterschrift konnte nicht verarbeitet werden.");
      setDocumentFile(null);
      return;
    }
    const header = signatureDataUrl.slice(0, commaIndex);
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = (mimeMatch?.[1] ?? "image/png").toLowerCase();
    const base64 = signatureDataUrl.slice(commaIndex + 1);
    try {
      const binary = atob(base64);
      const length = binary.length;
      const bytes = new Uint8Array(length);
      for (let index = 0; index < length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const file = new File([bytes], "digitale-unterschrift.png", { type: mime || "image/png" });
      setDocumentFromFile(file);
    } catch (conversionError) {
      console.error("[onboarding.signature]", conversionError);
      setDocumentError("Unterschrift konnte nicht verarbeitet werden.");
      setDocumentFile(null);
    }
  }, [documentMode, signatureDataUrl, setDocumentError, setDocumentFile, setDocumentFromFile]);

  const goNext = () => {
    setError(null);
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!form.firstName.trim()) {
        setError("Bitte gib deinen Vornamen ein.");
        return;
      }
      if (!form.lastName.trim()) {
        setError("Bitte gib deinen Nachnamen ein.");
        return;
      }
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setError("Bitte nutze eine gültige E-Mail-Adresse.");
        return;
      }
      if (!form.password || form.password.length < 6) {
        setError("Bitte wähle ein Passwort mit mindestens 6 Zeichen.");
        return;
      }
      if (form.password !== form.passwordConfirm) {
        setError("Die Passwörter stimmen nicht überein.");
        return;
      }
      if (!form.background.trim()) {
        setError("Wo kommst du her? Schule, Uni, Ausbildung – ein Stichwort genügt.");
        return;
      }
      if (requiresBackgroundClass && !form.backgroundClass.trim()) {
        setError("Bitte gib deine Klasse am BSZ an.");
        return;
      }
      if (form.genderOption === "custom" && !form.genderCustom.trim()) {
        setError("Bitte beschreibe dein Geschlecht oder wähle eine Option aus der Liste.");
        return;
      }
      const sinceYear = form.memberSinceYear.trim();
      if (sinceYear) {
        const parsedYear = Number.parseInt(sinceYear, 10);
        if (!Number.isFinite(parsedYear) || sinceYear.length !== 4 || parsedYear < 1900 || parsedYear > CURRENT_YEAR) {
          setError(`Bitte gib ein gültiges Jahr zwischen 1900 und ${CURRENT_YEAR} an.`);
          return;
        }
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const wantsActing = form.focus === "acting" || form.focus === "both";
      const wantsCrew = form.focus === "tech" || form.focus === "both";
      if (wantsActing && !form.actingPreferences.some((pref) => pref.enabled && pref.weight > 0)) {
        setError("Wähle mindestens eine Option im Schauspielbereich.");
        return;
      }
      if (wantsCrew && !form.crewPreferences.some((pref) => pref.enabled && pref.weight > 0)) {
        setError("Wähle mindestens ein Gewerk aus, das dich reizt.");
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    if (step === 4) {
      if (!form.photoConsent.consent) {
        setError("Wir benötigen deine Zustimmung zur Fotoerlaubnis, damit du beim Theater mitmachen kannst.");
        return;
      }
      if (!documentFile) {
        setError(
          isMinor
            ? "Bitte lade die unterschriebene Erklärung deiner Erziehungsberechtigten hoch."
            : "Bitte lade dein unterschriebenes Einverständnis hoch oder unterschreibe digital.",
        );
        return;
      }
      setStep(5);
      return;
    }
    if (step === 5) {
      if (form.nutritionStyle === "custom" && !form.nutritionCustomStyle.trim()) {
        setError("Bitte beschreibe deinen Ernährungsstil oder wähle eine vorhandene Option.");
        return;
      }
      setStep(6);
      return;
    }
    if (step === 6) {
      setStep(7);
      return;
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 0) return;
    setStep((prev) => Math.max(0, prev - 1));
  };

  const goToStep = useCallback(
    (target: number) => {
      if (target >= step) return;
      setError(null);
      setStep(target);
    },
    [setError, setStep, step],
  );

  const handleSubmit = async () => {
    setError(null);
    if (loading) return;
    const includeActing = form.focus === "acting" || form.focus === "both";
    const includeCrew = form.focus === "tech" || form.focus === "both";
    const preferences: { code: string; domain: "acting" | "crew"; weight: number }[] = [
      ...(includeActing
        ? form.actingPreferences
            .filter((pref) => pref.enabled && pref.weight > 0)
            .map((pref) => ({ code: pref.code, domain: "acting" as const, weight: pref.weight }))
        : []),
      ...(includeCrew
        ? form.crewPreferences
            .filter((pref) => pref.enabled && pref.weight > 0)
            .map((pref) => ({ code: pref.code, domain: "crew" as const, weight: pref.weight }))
        : []),
    ];
    if (!preferences.length) {
      setError("Bitte markiere, wo du dich einbringen möchtest.");
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      const genderCustom = form.genderCustom.trim();
      const nutritionCustom = form.nutritionCustomStyle.trim();
      const trimmedYear = form.memberSinceYear.trim();
      const parsedYear = trimmedYear ? Number.parseInt(trimmedYear, 10) : Number.NaN;
      const memberSinceYear = Number.isFinite(parsedYear) ? parsedYear : null;
      const notes = form.notes.trim();
      const payload = {
        sessionToken,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        background: form.background.trim(),
        backgroundClass: backgroundClassLabel,
        notes: notes || null,
        dateOfBirth: form.dateOfBirth ? form.dateOfBirth : null,
        gender: {
          option: form.genderOption,
          custom: genderCustom || null,
        },
        memberSinceYear,
        focus: form.focus,
        preferences,
        interests: form.interests,
        dietaryPreference: {
          style: form.nutritionStyle,
          custom: nutritionCustom || null,
          strictness: form.nutritionStrictness,
        },
        photoConsent: {
          consent: form.photoConsent.consent,
        },
        dietary: form.dietary.map((entry) => ({
          allergen: entry.allergen,
          level: entry.level,
          symptoms: entry.symptoms,
          treatment: entry.treatment,
          note: entry.note,
        })),
      };

      const body = new FormData();
      body.append("payload", JSON.stringify(payload));
      if (documentFile) {
        body.append("document", documentFile);
      }

      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error ?? "Übermittlung fehlgeschlagen";
        setError(message);
        if (message.toLowerCase().includes("dokument")) {
          setStep(4);
        }
        return;
      }
      setSuccess(true);
      toast.success("Willkommen im Ensemble! Wir melden uns bei dir.");

      const signInEmail = typeof data?.user?.email === "string" ? data.user.email : form.email.trim();
      const signInResult = await signIn("credentials", {
        email: signInEmail,
        password: form.password,
        redirect: false,
        callbackUrl: "/mitglieder",
      });

      if (signInResult?.error) {
        toast.error("Automatischer Login fehlgeschlagen. Du kannst dich später manuell anmelden.");
      } else if (signInResult?.url) {
        router.push(signInResult.url);
      } else {
        router.push("/mitglieder");
      }
    } catch (err) {
      console.error("[onboarding.wizard]", err);
      setError("Netzwerkfehler – bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  };

  const inviteCreatedAt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(invite.createdAt));
    } catch {
      return null;
    }
  }, [invite.createdAt]);

  const inviteExpiresAt = useMemo(() => {
    if (!invite.expiresAt) return null;
    try {
      return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(invite.expiresAt));
    } catch {
      return null;
    }
  }, [invite.expiresAt]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <Card className="border border-border/70 bg-gradient-to-br from-background to-background/70">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold sm:text-2xl">Dein Einstieg ins Theater</CardTitle>
            <p className="text-sm text-muted-foreground">
              Einladung erstellt {inviteCreatedAt ? `am ${inviteCreatedAt}` : "vor Kurzem"}
              {invite.createdBy ? ` von ${invite.createdBy}` : ""}.
              {inviteExpiresAt ? ` Gültig bis ${inviteExpiresAt}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:flex-nowrap">
            <Badge variant="outline">Link-ID gesichert</Badge>
            {invite.remainingUses !== null ? (
              <span>{invite.remainingUses} von {invite.remainingUses + invite.usageCount} Plätzen frei</span>
            ) : (
              <span>Mehrfach nutzbar</span>
            )}
          </div>
        </CardHeader>
      </Card>

      <nav
        aria-label="Onboarding-Fortschritt"
        className="max-w-full overflow-x-auto rounded-xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm sm:overflow-visible sm:border-none sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none"
      >
        <ol className="flex list-none flex-wrap items-center gap-3 md:flex-nowrap">
          {steps.map((item, index) => {
            const isActive = index === step;
            const isComplete = index < step;
            const isFuture = index > step;
            return (
              <li key={item.title} className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  disabled={isFuture}
                  className={cn(
                    "group flex shrink-0 flex-col items-center gap-1 rounded-lg bg-transparent px-2 py-1 text-center focus-visible:outline-none md:flex-row md:items-center md:gap-2 md:px-0 md:py-0 md:text-left",
                    isComplete ? "cursor-pointer" : "cursor-default",
                  )}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={
                    isComplete
                      ? `Zurück zu Schritt ${index + 1}: ${item.title}`
                      : `Schritt ${index + 1}: ${item.title}`
                  }
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isComplete && !isActive && "border-primary bg-primary/20 text-primary",
                      !isActive && !isComplete && "border-border text-muted-foreground",
                      "group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
                    )}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium md:text-sm",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {item.title}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <div className="hidden h-px w-10 shrink-0 bg-border md:block" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {step === 0 && (
        <Card className="border border-border/70 bg-background/80 shadow-xl">
          <CardContent className="space-y-5 px-5 py-6 text-center sm:space-y-6 sm:px-8 sm:py-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">Willkommen im Zukunftstheater</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Schön, dass du da bist! Nimm dir 10 Minuten Zeit, such dir einen ruhigen Ort und lass uns gemeinsam herausfinden, wie du
              dich auf der Bühne oder hinter den Kulissen einbringen möchtest.
            </p>
            <Button size="lg" onClick={goNext}>
              Los geht&apos;s
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Wer bist du?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wir nutzen diese Angaben, um dein Profil anzulegen, dich zu erreichen und deinen Mitglieder-Login zu aktivieren.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Vorname</span>
                <Input
                  value={form.firstName}
                  onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  placeholder="Vorname"
                  autoComplete="given-name"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Nachname</span>
                <Input
                  value={form.lastName}
                  onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  placeholder="Nachname"
                  autoComplete="family-name"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="font-medium">E-Mail</span>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="du@example.com"
                  autoComplete="email"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Passwort</span>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Mindestens 6 Zeichen"
                  autoComplete="new-password"
                />
                <span className="text-xs text-muted-foreground">
                  Damit meldest du dich später im Dashboard an. Bitte bewahre es sicher auf.
                </span>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Passwort bestätigen</span>
                <Input
                  type="password"
                  value={form.passwordConfirm}
                  onChange={(event) => setForm((prev) => ({ ...prev, passwordConfirm: event.target.value }))}
                  placeholder="Noch einmal eingeben"
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Geburtsdatum</span>
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                />
                <span className="text-xs text-muted-foreground">Damit wissen wir, ob wir ein Eltern-Formular benötigen.</span>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Was machst du aktuell schulisch oder beruflich?</span>
                <Input
                  value={form.background}
                  onChange={(event) => setForm((prev) => ({ ...prev, background: event.target.value }))}
                  placeholder="z.B. BSZ Altroßthal – Berufsschule"
                />
                <span className="text-xs text-muted-foreground">
                  Erzähl uns kurz, ob du zur Schule gehst, eine Ausbildung machst oder bereits arbeitest.
                </span>
                <div className="flex flex-wrap gap-2 pt-2">
                  {backgroundSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                      onClick={() => setForm((prev) => ({ ...prev, background: suggestion }))}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </label>
              {requiresBackgroundClass && (
                <label className="space-y-1 text-sm md:col-start-2">
                  <span className="font-medium">Welche Klasse besuchst du am BSZ Altroßthal/Canaletto?</span>
                  <Input
                    value={form.backgroundClass}
                    onChange={(event) => setForm((prev) => ({ ...prev, backgroundClass: event.target.value }))}
                    placeholder="z.B. BFS 23A"
                  />
                  <span className="text-xs text-muted-foreground">
                    Damit können wir dich deinem Jahrgang zuordnen.
                  </span>
                </label>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm">
                <span className="font-medium">Geschlecht</span>
                <Select
                  value={form.genderOption}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      genderOption: value as GenderOption,
                      genderCustom: value === "custom" ? prev.genderCustom : "",
                    }))
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Wähle eine Option" />
                  </SelectTrigger>
                  <SelectContent>
                    {genderOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.genderOption === "custom" && (
                  <Input
                    value={form.genderCustom}
                    onChange={(event) => setForm((prev) => ({ ...prev, genderCustom: event.target.value }))}
                    placeholder="Wie beschreibst du dich?"
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  Hilft uns bei Anreden und Texten. Du kannst die Angabe später jederzeit ändern.
                </span>
              </div>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Seit wann bist du beim Theater?</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.memberSinceYear}
                  onChange={(event) => setForm((prev) => ({ ...prev, memberSinceYear: event.target.value }))}
                  placeholder={`z.B. ${CURRENT_YEAR}`}
                  min="1900"
                  max={String(CURRENT_YEAR)}
                />
                <span className="text-xs text-muted-foreground">
                  Falls du gerade startest, lass das Feld frei oder nutze das aktuelle Jahr.
                </span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Wohin zieht es dich?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wähle aus, ob du dich eher im Schauspiel, hinter den Kulissen oder in beiden Welten siehst. Danach kannst du gewichten,
              was dich am meisten reizt.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {[
                { value: "acting", label: "Schauspiel", description: "Auf der Bühne stehen, Rollen gestalten." },
                { value: "tech", label: "Gewerke", description: "Technik, Kostüm, Bühnenbild und Organisation." },
                { value: "both", label: "Beides", description: "Ich möchte mich offen halten." },
              ].map((option) => {
                const active = form.focus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex min-w-[180px] flex-1 flex-col gap-1 rounded-lg border p-4 text-left transition",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/70 hover:text-foreground",
                    )}
                    onClick={() => setForm((prev) => ({ ...prev, focus: option.value as typeof prev.focus }))}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-xs">{option.description}</span>
                  </button>
                );
              })}
            </div>

            {(form.focus === "acting" || form.focus === "both") && (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Schauspiel</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {form.actingPreferences.map((pref) => {
                    const active = pref.enabled;
                    const weightLabel = [...weightLabels].reverse().find((label) => pref.weight >= label.threshold)?.label ?? "";
                    return (
                      <div
                        key={pref.code}
                        className={cn(
                          "flex flex-col gap-4 rounded-xl border p-4 transition",
                          active ? "border-primary bg-primary/5" : "border-border bg-background",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-medium">{pref.title}</h4>
                            <p className="text-sm text-muted-foreground">{pref.description}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={active ? "default" : "outline"}
                            onClick={() => togglePreference("acting", pref.code)}
                          >
                            {active ? "Ausgewählt" : "Wählen"}
                          </Button>
                        </div>
                        {active && (
                          <div className="space-y-2">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={10}
                              value={pref.weight}
                              onChange={(event) =>
                                updatePreferenceWeight("acting", pref.code, event.currentTarget.valueAsNumber)
                              }
                              onInput={(event) =>
                                updatePreferenceWeight("acting", pref.code, event.currentTarget.valueAsNumber)
                              }
                              className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Intensität</span>
                              <span>{weightLabel}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {(form.focus === "tech" || form.focus === "both") && (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gewerke & Teams</h3>
                <p className="text-xs text-muted-foreground">
                  Wähle bestehende Bereiche oder ergänze dein eigenes Gewerk, wenn dir noch etwas fehlt.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {form.crewPreferences.map((pref) => {
                    const active = pref.enabled;
                    const weightLabel = [...weightLabels].reverse().find((label) => pref.weight >= label.threshold)?.label ?? "";
                    return (
                      <div
                        key={pref.code}
                        className={cn(
                          "flex flex-col gap-4 rounded-2xl border p-4 transition",
                          active ? "border-primary/70 bg-primary/5 shadow-sm" : "border-border bg-background/90",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{pref.title}</h4>
                              {pref.isCustom && (
                                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                                  Eigenes Gewerk
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {pref.description || "Individuelle Aufgabe im Team"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Button
                              size="sm"
                              variant={active ? "default" : "outline"}
                              onClick={() => togglePreference("crew", pref.code)}
                            >
                              {active ? "Ausgewählt" : "Wählen"}
                            </Button>
                            {pref.isCustom && (
                              <button
                                type="button"
                                className="text-xs text-destructive transition hover:underline"
                                onClick={() => removeCustomCrewPreference(pref.code)}
                              >
                                Entfernen
                              </button>
                            )}
                          </div>
                        </div>
                        {active && (
                          <div className="space-y-2">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={10}
                              value={pref.weight}
                              onChange={(event) =>
                                updatePreferenceWeight("crew", pref.code, event.currentTarget.valueAsNumber)
                              }
                              onInput={(event) =>
                                updatePreferenceWeight("crew", pref.code, event.currentTarget.valueAsNumber)
                              }
                              className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Intensität</span>
                              <span>{weightLabel}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 md:col-span-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                          <Sparkles className="h-4 w-4" />
                          Eigenes Gewerk ergänzen
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Fehlt ein Bereich? Beschreibe kurz das Team oder Projekt, das du übernehmen möchtest.
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={addCustomCrewPreference}>
                        Hinzufügen
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span>Titel</span>
                        <Input
                          value={customCrewDraft.title}
                          onChange={(event) => {
                            setCustomCrewError(null);
                            setCustomCrewDraft((prev) => ({ ...prev, title: event.target.value }));
                          }}
                          placeholder="z.B. Social Media, Podcast, Stage Crew …"
                        />
                      </label>
                      <label className="space-y-1 text-sm md:col-span-2">
                        <span>Beschreibung (optional)</span>
                        <Textarea
                          value={customCrewDraft.description}
                          onChange={(event) => {
                            setCustomCrewError(null);
                            setCustomCrewDraft((prev) => ({ ...prev, description: event.target.value }));
                          }}
                          placeholder="Was möchtest du übernehmen? Material, Organisation, besondere Idee …"
                          rows={3}
                        />
                      </label>
                    </div>
                    {customCrewError && <p className="text-xs text-destructive">{customCrewError}</p>}
                  </div>
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Was begeistert dich?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sammle Interessen als Schlagworte – so finden wir passende Teams, Workshops und Rollen für dich. Auch neue Ideen sind
              willkommen.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {form.interests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                >
                  {interest}
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-primary/70 transition hover:bg-primary/20"
                    onClick={() => removeInterest(interest)}
                    aria-label={`${interest} entfernen`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {!form.interests.length && <span className="text-sm text-muted-foreground">Noch keine Interessen ausgewählt.</span>}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={newInterest}
                onChange={(event) => handleInterestInputChange(event.target.value)}
                placeholder="z.B. Impro, Tanz, Requisite, Social Media …"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addInterest(newInterest);
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => addInterest(newInterest)}>
                Hinzufügen
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Beliebte Tags</p>
              <div className="flex flex-wrap gap-2">
                {interestsLoading && <span className="text-xs text-muted-foreground">Lade Vorschläge …</span>}
                {!interestsLoading &&
                  availableInterestSuggestions.map((interest) => (
                    <button
                      key={interest.name}
                      type="button"
                      className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                      onClick={() => addInterest(interest.name)}
                    >
                      <span>{interest.name}</span>
                      {interest.usage > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {interest.usage}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Fotoeinverständnis</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wir dokumentieren Proben, Aufführungen und Werkstätten. Deine Zustimmung hilft uns bei Social Media, Presse und
              Erinnerungen.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="flex items-start gap-3 rounded-lg border border-border/70 p-4">
              <input
                type="checkbox"
                checked={form.photoConsent.consent}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, photoConsent: { ...prev.photoConsent, consent: event.target.checked } }))
                }
                className="mt-1 h-4 w-4"
              />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Ich bin einverstanden, dass Fotos/Videos von mir für das Schultheater genutzt werden.</p>
                <p className="text-xs text-muted-foreground">
                  Die Zustimmung kann jederzeit im Profil angepasst werden.
                </p>
              </div>
            </label>

            {isMinor ? (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                <p className="font-medium">Du bist unter 18 Jahre alt</p>
                <p>
                  Wir benötigen die unterschriebene Foto-Einverständniserklärung deiner Erziehungsberechtigten. Lade das Dokument
                  als PDF oder Bilddatei hoch – ohne dieses Formular können wir dich leider nicht aufnehmen.
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                <p className="font-medium">Du bist volljährig</p>
                <p>Du kannst das Formular als Datei hochladen oder hier direkt digital unterschreiben.</p>
              </div>
            )}

            <div className="space-y-3 text-sm">
              {isMinor ? (
                <div className="space-y-2">
                  <label className="block font-medium">Einverständnis der Erziehungsberechtigten (PDF, JPG, PNG)</label>
                  <Input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(event) => handleDocumentInput(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {documentFile
                      ? `Ausgewählt: ${documentFile.name}`
                      : "Lade die unterschriebene Zustimmung deiner Erziehungsberechtigten hoch."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={documentMode === "upload" ? "default" : "outline"}
                      onClick={handleSelectUploadMode}
                    >
                      Dokument hochladen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={documentMode === "signature" ? "default" : "outline"}
                      onClick={handleSelectSignatureMode}
                    >
                      Digital unterschreiben
                    </Button>
                  </div>
                  {documentMode === "upload" ? (
                    <div className="space-y-2">
                      <label className="block font-medium">Einverständnis (PDF, JPG, PNG)</label>
                      <Input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={(event) => handleDocumentInput(event.target.files?.[0] ?? null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {documentFile
                          ? `Ausgewählt: ${documentFile.name}`
                          : "Lade dein unterschriebenes Formular hoch."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block font-medium">Digital unterschreiben</label>
                      <SignaturePad value={signatureDataUrl} onChange={handleSignatureChange} />
                      <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
                        <p>
                          {documentFile
                            ? "Deine digitale Unterschrift wird mitgeschickt."
                            : "Zeichne deine Unterschrift mit Finger, Stift oder Maus."}
                        </p>
                        <p>
                          Mit meiner digitalen Unterschrift erlaube ich dem Schultheater, Fotos und Videos von mir im Rahmen
                          von Proben, Aufführungen und der Öffentlichkeitsarbeit zu erstellen und zu veröffentlichen. Mir ist
                          bewusst, dass ich diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen kann.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              {documentError && <p className="text-xs text-destructive">{documentError}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card className="border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Ernährung, Unverträglichkeiten &amp; Bedürfnisse
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Verrate uns deinen Ernährungsstil und mögliche Unverträglichkeiten – so planen wir Verpflegung, Proben und Events sicher und inklusiv. Alle Angaben sind optional.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/85 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <span className="font-medium">Ernährungsstil</span>
                  <Select
                    value={form.nutritionStyle}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        nutritionStyle: value as DietaryStyleOption,
                        nutritionCustomStyle: value === "custom" ? prev.nutritionCustomStyle : "",
                      }))
                    }
                  >
                    <SelectTrigger className="bg-background/80">
                      <SelectValue placeholder="Wähle deinen Stil" />
                    </SelectTrigger>
                    <SelectContent>
                      {dietaryStyleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.nutritionStyle === "custom" && (
                    <Input
                      value={form.nutritionCustomStyle}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, nutritionCustomStyle: event.target.value }))
                      }
                      placeholder="Beschreibe deinen Ernährungsstil"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Zum Beispiel vegan, vegetarisch, halal oder ein eigener Mix.
                  </p>
                </div>
                <div className="space-y-1 text-sm">
                  <span className="font-medium">Wie konsequent hältst du dich daran?</span>
                  <Select
                    value={form.nutritionStrictness}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, nutritionStrictness: value as DietaryStrictnessOption }))
                    }
                  >
                    <SelectTrigger className="bg-background/80">
                      <SelectValue placeholder="Wähle eine Option" />
                    </SelectTrigger>
                    <SelectContent>
                      {dietaryStrictnessOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    So können wir besser einschätzen, ob Ausnahmen für dich in Ordnung sind.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-4">
              {form.dietary.map((entry) => {
                const style = allergyLevelStyles[entry.level];
                const progress = allergyLevelIntensity[entry.level];
                return (
                  <div key={entry.id} className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-5 shadow-sm">
                    <div className={cn("absolute inset-x-5 top-0 h-px bg-gradient-to-r", style.accent)} aria-hidden />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{entry.allergen}</p>
                        <Badge className={cn("text-[11px]", style.badge)}>{allergyLevelLabels[entry.level]}</Badge>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => removeDietary(entry.id)}>
                        Entfernen
                      </Button>
                    </div>
                    {(entry.symptoms || entry.treatment || entry.note) && (
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {entry.symptoms && (
                          <p>
                            <span className="font-medium text-foreground/80">Symptome:</span> {entry.symptoms}
                          </p>
                        )}
                        {entry.treatment && (
                          <p>
                            <span className="font-medium text-foreground/80">Behandlung:</span> {entry.treatment}
                          </p>
                        )}
                        {entry.note && (
                          <p>
                            <span className="font-medium text-foreground/80">Hinweis:</span> {entry.note}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r", style.accent)}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {!form.dietary.length && (
                <div className="rounded-2xl border border-dashed border-border/60 bg-background/70 p-6 text-sm text-muted-foreground">
                  Keine Besonderheiten hinterlegt – wir planen mit einem flexiblen Menü.
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Target className="h-4 w-4" />
                Neue Unverträglichkeit hinzufügen
              </div>
              <p className="text-xs text-muted-foreground">
                Teile nur, was relevant ist – die Informationen bleiben intern und helfen dem Orga-Team bei Notfällen.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span>Auslöser / Gericht</span>
                  <Input
                    value={dietaryDraft.allergen}
                    onChange={(event) => setDietaryDraft((prev) => ({ ...prev, allergen: event.target.value }))}
                    placeholder="z.B. Erdnüsse, Gluten, Laktose"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Schweregrad</span>
                  <Select
                    value={dietaryDraft.level}
                    onValueChange={(value: AllergyLevel) => setDietaryDraft((prev) => ({ ...prev, level: value }))}
                  >
                    <SelectTrigger className="bg-background/80">
                      <SelectValue placeholder="Wähle den Schweregrad" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(AllergyLevel).map((level) => (
                        <SelectItem key={level} value={level}>
                          {allergyLevelLabels[level]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Textarea
                  value={dietaryDraft.symptoms}
                  onChange={(event) => setDietaryDraft((prev) => ({ ...prev, symptoms: event.target.value }))}
                  placeholder="Symptome (optional)"
                  className="md:col-span-1"
                />
                <Textarea
                  value={dietaryDraft.treatment}
                  onChange={(event) => setDietaryDraft((prev) => ({ ...prev, treatment: event.target.value }))}
                  placeholder="Behandlung im Notfall"
                  className="md:col-span-1"
                />
                <Textarea
                  value={dietaryDraft.note}
                  onChange={(event) => setDietaryDraft((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="Weitere Hinweise"
                  className="md:col-span-1"
                />
              </div>
              <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                <span>Wir speichern die Angaben verschlüsselt und teilen sie nur mit dem verantwortlichen Team.</span>
                <Button type="button" onClick={handleAddDietary}>
                  Speichern
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Gibt es noch etwas, das wir wissen sollten?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Teile besondere Erfahrungen, Wünsche oder Hinweise – alles, was uns beim Kennenlernen helfen kann.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Optional: Besondere Erfahrungen, Wünsche oder Hinweise für das Team"
                className="min-h-[120px]"
                maxLength={1000}
                aria-label="Gibt es noch etwas, das wir wissen sollten?"
                aria-describedby={notesHelpId}
              />
              <span id={notesHelpId} className="block text-xs text-muted-foreground">
                Du kannst diesen Freitext später jederzeit in deinem Profil anpassen.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 7 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Zusammenfassung</CardTitle>
            <p className="text-sm text-muted-foreground">
              Schau alles noch einmal durch. Nach dem Absenden legen wir dein Profil an und melden uns mit den nächsten Schritten.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border/70 bg-background/90 p-4">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Profil</h3>
                <dl className="mt-3 grid gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium text-foreground">
                      {form.firstName || form.lastName
                        ? [form.firstName, form.lastName].filter(Boolean).join(" ")
                        : "–"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">E-Mail</dt>
                    <dd className="font-medium text-foreground">{form.email || "–"}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Geburtstag</dt>
                    <dd className="font-medium text-foreground">{form.dateOfBirth || "–"}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Alter</dt>
                    <dd className="font-medium text-foreground">{age !== null ? `${age} Jahre` : "–"}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Geschlecht</dt>
                    <dd className="font-medium text-foreground">{genderLabel}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Seit wann im Theater</dt>
                    <dd className="font-medium text-foreground">{memberSinceYearLabel}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Kontext</span>
                  {form.background ? (
                    <>
                      <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                        {form.background}
                      </Badge>
                      {backgroundClassLabel && (
                        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                          Klasse {backgroundClassLabel}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Keine Angaben</span>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Freitext</span>
                  {form.notes ? (
                    <p className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm leading-relaxed text-foreground/80">
                      {form.notes}
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground">Keine zusätzlichen Hinweise</span>
                  )}
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fokus &amp; Intensität</h3>
                  <span className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    focusBadgeStyles[form.focus],
                  )}
                  >
                    {focusLabels[form.focus]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{focusDescriptions[form.focus]}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {focusDomainMap[form.focus].map((domain) => {
                    const entries = preferenceSummary[domain];
                    const stats = preferenceStats[domain];
                    return (
                      <div key={domain} className="space-y-3 rounded-xl border border-border/60 bg-background/85 p-3">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                          <span>{domain === "acting" ? "Schauspiel" : "Gewerke"}</span>
                          <span>{stats.count} Auswahl{stats.count === 1 ? "" : "en"}</span>
                        </div>
                        {entries.length ? (
                          <div className="space-y-3">
                            {entries.map((pref) => (
                              <div key={pref.code} className="space-y-1.5">
                                <div className="flex items-center justify-between text-sm font-medium text-foreground">
                                  <div className="flex items-center gap-2">
                                    <span>{pref.title}</span>
                                    {pref.isCustom && (
                                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                                        Eigenes Gewerk
                                      </span>
                                    )}
                                  </div>
                                  <span>{pref.weight}%</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                                  <div
                                    className={cn("h-full rounded-full bg-gradient-to-r", preferenceAccent[pref.domain])}
                                    style={{ width: `${pref.weight}%` }}
                                  />
                                </div>
                                <p className="text-[11px] text-muted-foreground">{pref.label}</p>
                              </div>
                            ))}
                            <p className="text-[11px] text-muted-foreground">
                              Ø Intensität: {stats.average}%
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Keine Angaben</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border/70 bg-background/90 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Interessen</h3>
                <p className="text-xs text-muted-foreground">Wir nutzen deine Tags für Workshops, Rollen und Teamvorschläge.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.interests.length ? (
                    form.interests.map((interest) => (
                      <Badge key={interest} variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                        {interest}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Keine Angaben</span>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border/70 bg-background/90 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Ernährung &amp; Unverträglichkeiten
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Ernährungsstil</dt>
                    <dd className="font-medium text-foreground">{nutritionStyleLabel}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Umgang</dt>
                    <dd className="font-medium text-foreground">{nutritionStrictnessLabel}</dd>
                  </div>
                </dl>
                {form.dietary.length ? (
                  <div className="mt-3 space-y-3 text-sm">
                    {form.dietary.map((entry) => {
                      const style = allergyLevelStyles[entry.level];
                      return (
                        <div key={entry.id} className="space-y-1 rounded-xl border border-border/50 bg-background/80 p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{entry.allergen}</span>
                            <Badge className={cn("text-[10px]", style.badge)}>{allergyLevelLabels[entry.level]}</Badge>
                          </div>
                          {(entry.symptoms || entry.treatment || entry.note) && (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {entry.symptoms && <p>Symptome: {entry.symptoms}</p>}
                              {entry.treatment && <p>Behandlung: {entry.treatment}</p>}
                              {entry.note && <p>Hinweis: {entry.note}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Keine Angaben</p>
                )}
              </section>
            </div>

            <section className="space-y-4 rounded-2xl border border-border/70 bg-background/90 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sicherheit &amp; Zustimmung</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-border/60 bg-background p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Fotoerlaubnis
                    </div>
                    <Badge
                      variant="outline"
                      className={form.photoConsent.consent ? "border-emerald-400/40 bg-emerald-50 text-emerald-700" : "border-amber-400/40 bg-amber-50 text-amber-700"}
                    >
                      {form.photoConsent.consent ? "Erteilt" : "Offen"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{photoConsentMessage}</p>
                </div>
                <div className="space-y-2 rounded-xl border border-border/60 bg-background p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Lock className="h-4 w-4 text-primary" />
                    Passwort gesetzt
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dein neues Passwort wird mit dem Absenden aktiviert. Du kannst dich anschließend sofort im Mitgliederbereich anmelden.
                  </p>
                </div>
              </div>
            </section>

            {success ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                <p className="font-medium">Danke, deine Angaben sind angekommen!</p>
                <p>
                  Wir legen jetzt dein Profil an und melden uns mit den nächsten Schritten. Du kannst dich ab sofort mit deiner E-Mail-Adresse und deinem Passwort im Mitgliederbereich anmelden.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/login">
                    <Button>Zum Mitglieder-Login</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? "Wird übertragen …" : "Angaben absenden"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step > 0 && step < 7 && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Zurück
          </Button>
          <Button onClick={goNext} disabled={loading} className="w-full sm:w-auto">
            Weiter
          </Button>
        </div>
      )}

      {error && step !== 7 && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
