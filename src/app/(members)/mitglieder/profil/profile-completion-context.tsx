"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type {
  ProfileChecklistItemId,
  ProfileCompletionSummary,
} from "@/lib/profile-completion";

type ProfileCompletionContextValue = {
  summary: ProfileCompletionSummary;
  setItemCompletion: (id: ProfileChecklistItemId, complete: boolean) => void;
  replaceSummary: (summary: ProfileCompletionSummary) => void;
};

const ProfileCompletionContext = createContext<ProfileCompletionContextValue | null>(null);

type ProfileCompletionProviderProps = {
  initialSummary: ProfileCompletionSummary;
  children: React.ReactNode;
};

export function ProfileCompletionProvider({ initialSummary, children }: ProfileCompletionProviderProps) {
  const [summary, setSummary] = useState<ProfileCompletionSummary>(initialSummary);

  const setItemCompletion = useCallback((id: ProfileChecklistItemId, complete: boolean) => {
    setSummary((prev) => {
      const items = prev.items.map((item) =>
        item.id === id ? { ...item, complete } : item,
      );
      const completed = items.filter((item) => item.complete).length;
      return {
        items,
        completed,
        total: items.length,
        complete: completed === items.length && items.length > 0,
      } satisfies ProfileCompletionSummary;
    });
  }, []);

  const replaceSummary = useCallback((value: ProfileCompletionSummary) => {
    setSummary(value);
  }, []);

  const value = useMemo<ProfileCompletionContextValue>(
    () => ({ summary, setItemCompletion, replaceSummary }),
    [summary, setItemCompletion, replaceSummary],
  );

  return <ProfileCompletionContext.Provider value={value}>{children}</ProfileCompletionContext.Provider>;
}

export function useProfileCompletion() {
  const context = useContext(ProfileCompletionContext);
  if (!context) {
    throw new Error("useProfileCompletion must be used within ProfileCompletionProvider");
  }
  return context;
}

