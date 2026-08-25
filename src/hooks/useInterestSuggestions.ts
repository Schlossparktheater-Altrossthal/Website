"use client";

import { useCallback, useEffect, useState } from "react";

import { parseInterestSuggestions, type InterestSuggestion } from "@/lib/interests";

type Options = {
  immediate?: boolean;
  initial?: InterestSuggestion[];
};

function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useInterestSuggestions(options?: Options) {
  const { immediate = true, initial = [] } = options ?? {};
  const [suggestions, setSuggestions] = useState<InterestSuggestion[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve();
    if (signal?.aborted) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/onboarding/interests", { cache: "no-store", signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = await response.json().catch(() => null);
      if (signal?.aborted) {
        return;
      }
      const parsed = parseInterestSuggestions(data);
      setSuggestions(parsed);
      setError(null);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error("[useInterestSuggestions]", error);
      setError("Vorschläge konnten nicht geladen werden.");
      if (!signal?.aborted) {
        setSuggestions([]);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!immediate) {
      return undefined;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      void load(controller.signal);
    });
    return () => {
      controller.abort();
    };
  }, [immediate, load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { suggestions, loading, error, refresh } as const;
}
