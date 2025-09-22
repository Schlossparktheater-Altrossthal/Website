"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { useSession } from "next-auth/react";

import type {
  FrontendEditingFeature,
  FrontendEditingFeatureKey,
} from "@/lib/frontend-editing";

const FrontendEditingContext = createContext<FrontendEditingContextValue | null>(null);

type FrontendEditingContextValue = {
  status: "loading" | "authenticated" | "unauthenticated";
  loading: boolean;
  error: string | null;
  features: FrontendEditingFeature[];
  activeFeature: FrontendEditingFeatureKey | null;
  hasFeature: (key: FrontendEditingFeatureKey) => boolean;
  openFeature: (key: FrontendEditingFeatureKey) => void;
  closeFeature: () => void;
  toggleFeature: (key: FrontendEditingFeatureKey) => void;
  refresh: () => void;
};

type ReloadAction = { type: "trigger" };

function reloadReducer(state: number, action: ReloadAction) {
  switch (action.type) {
    case "trigger":
      return state + 1;
    default:
      return state;
  }
}

export function FrontendEditingProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [features, setFeatures] = useState<FrontendEditingFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState<FrontendEditingFeatureKey | null>(null);
  const [reloadKey, triggerReload] = useReducer(reloadReducer, 0);

  useEffect(() => {
    let ignore = false;
    const abortController = new AbortController();

    if (status !== "authenticated") {
      setFeatures([]);
      setLoading(false);
      setError(null);
      setActiveFeature(null);
      return () => {
        ignore = true;
        abortController.abort();
      };
    }

    async function loadFeatures() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/frontend-editing", {
          credentials: "include",
          signal: abortController.signal,
        });
        const data = (await response.json().catch(() => ({}))) as {
          features?: FrontendEditingFeature[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data?.error || "Bearbeitungsrechte konnten nicht geladen werden.");
        }
        if (!ignore) {
          setFeatures(Array.isArray(data.features) ? data.features : []);
        }
      } catch (err) {
        if (ignore) return;
        if ((err as Error).name === "AbortError") return;
        console.error("Failed to load frontend editing permissions", err);
        setFeatures([]);
        setError(err instanceof Error ? err.message : "Unbekannter Fehler beim Laden der Bearbeitungsrechte.");
        setActiveFeature(null);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadFeatures();

    return () => {
      ignore = true;
      abortController.abort();
    };
  }, [status, reloadKey]);

  useEffect(() => {
    if (activeFeature && !features.some((feature) => feature.key === activeFeature)) {
      setActiveFeature(null);
    }
  }, [activeFeature, features]);

  const hasFeature = useCallback(
    (key: FrontendEditingFeatureKey) => features.some((feature) => feature.key === key),
    [features],
  );

  const openFeature = useCallback(
    (key: FrontendEditingFeatureKey) => {
      if (!hasFeature(key)) return;
      setActiveFeature(key);
    },
    [hasFeature],
  );

  const closeFeature = useCallback(() => setActiveFeature(null), []);

  const toggleFeature = useCallback(
    (key: FrontendEditingFeatureKey) => {
      setActiveFeature((current) => {
        if (current === key) return null;
        if (!hasFeature(key)) return current;
        return key;
      });
    },
    [hasFeature],
  );

  const refresh = useCallback(() => {
    if (status === "authenticated") {
      triggerReload({ type: "trigger" });
    }
  }, [status]);

  const value = useMemo<FrontendEditingContextValue>(
    () => ({
      status,
      loading,
      error,
      features,
      activeFeature,
      hasFeature,
      openFeature,
      closeFeature,
      toggleFeature,
      refresh,
    }),
    [status, loading, error, features, activeFeature, hasFeature, openFeature, closeFeature, toggleFeature, refresh],
  );

  return <FrontendEditingContext.Provider value={value}>{children}</FrontendEditingContext.Provider>;
}

export function useFrontendEditing() {
  const context = useContext(FrontendEditingContext);
  if (!context) {
    throw new Error("useFrontendEditing must be used within a FrontendEditingProvider");
  }
  return context;
}
