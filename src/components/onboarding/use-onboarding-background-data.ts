"use client";

import { useEffect, useMemo, useState } from "react";

import {
  findMatchingBackgroundTag,
  normalizeBackgroundLabel,
  type BackgroundTag,
} from "@/data/onboarding-backgrounds";

type UseOnboardingBackgroundDataOptions = {
  initialSuggestions?: readonly string[] | string[];
};

function sanitizeSuggestions(input: UseOnboardingBackgroundDataOptions["initialSuggestions"]) {
  if (!input) {
    return ["Schule", "Ausbildung", "Beruf"];
  }
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = normalizeBackgroundLabel(trimmed) || trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(trimmed);
  }
  return entries.length ? entries : ["Schule", "Ausbildung", "Beruf"];
}

export function useOnboardingBackgroundData(
  background: string,
  options?: UseOnboardingBackgroundDataOptions,
): {
  backgroundSuggestions: string[];
  classSuggestions: string[];
  activeTag: BackgroundTag | null;
  requiresClass: boolean;
} {
  const baseSuggestions = useMemo(() => sanitizeSuggestions(options?.initialSuggestions), [options?.initialSuggestions]);
  const [backgroundSuggestions, setBackgroundSuggestions] = useState<string[]>(baseSuggestions);
  const [classSuggestions, setClassSuggestions] = useState<string[]>([]);

  const activeTag = useMemo(() => findMatchingBackgroundTag(background), [background]);
  const requiresClass = activeTag?.requiresClass ?? false;

  useEffect(() => {
    let cancelled = false;

    const loadBackgrounds = async () => {
      try {
        const response = await fetch("/api/onboarding/backgrounds", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (cancelled || !Array.isArray(data?.backgrounds)) return;
        setBackgroundSuggestions((prev) => {
          const seen = new Set(prev.map((entry) => normalizeBackgroundLabel(entry) || entry.toLowerCase()));
          const merged = [...prev];
          for (const raw of data.backgrounds as unknown[]) {
            let label: string | null = null;
            if (typeof raw === "string") {
              label = raw;
            } else if (raw && typeof raw === "object" && typeof (raw as { name?: unknown }).name === "string") {
              label = (raw as { name: string }).name;
            }
            if (!label) continue;
            const trimmed = label.trim();
            if (!trimmed) continue;
            const key = normalizeBackgroundLabel(trimmed) || trimmed.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(trimmed);
          }
          return merged;
        });
      } catch {
        // optional suggestions, ignore errors
      }
    };

    void loadBackgrounds();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // keep suggestions in sync with option changes
    setBackgroundSuggestions((prev) => {
      const seen = new Set(baseSuggestions.map((entry) => normalizeBackgroundLabel(entry) || entry.toLowerCase()));
      const merged = [...baseSuggestions];
      for (const entry of prev) {
        const key = normalizeBackgroundLabel(entry) || entry.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(entry);
      }
      return merged;
    });
  }, [baseSuggestions]);

  useEffect(() => {
    if (!requiresClass) {
      setClassSuggestions([]);
      return;
    }

    let cancelled = false;

    const loadClasses = async () => {
      try {
        const response = await fetch("/api/onboarding/background-classes", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (cancelled || !Array.isArray(data?.classes)) return;
        const entries = (data.classes as unknown[])
          .map((entry): string | null => {
            if (typeof entry === "string") return entry.trim();
            if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
              return (entry as { name: string }).name.trim();
            }
            return null;
          })
          .filter((value): value is string => Boolean(value));
        const unique = Array.from(new Set(entries));
        if (!cancelled) setClassSuggestions(unique);
      } catch {
        if (!cancelled) setClassSuggestions([]);
      }
    };

    void loadClasses();

    return () => {
      cancelled = true;
    };
  }, [requiresClass, activeTag?.value]);

  return { backgroundSuggestions, classSuggestions, activeTag, requiresClass };
}
