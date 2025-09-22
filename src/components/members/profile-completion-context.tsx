"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type {
  ProfileChecklistItem,
  ProfileChecklistItemId,
} from "@/lib/profile-completion";

interface ProfileCompletionValue {
  items: ProfileChecklistItem[];
  completed: number;
  total: number;
  isComplete: boolean;
  setItemComplete: (id: ProfileChecklistItemId, complete: boolean) => void;
}

const ProfileCompletionContext =
  createContext<ProfileCompletionValue | null>(null);

interface ProfileCompletionProviderProps {
  initialItems: ProfileChecklistItem[];
  children: React.ReactNode;
}

export function ProfileCompletionProvider({
  initialItems,
  children,
}: ProfileCompletionProviderProps) {
  const [items, setItems] = useState<ProfileChecklistItem[]>(initialItems);

  const setItemComplete = useCallback(
    (id: ProfileChecklistItemId, complete: boolean) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, complete } : item,
        ),
      );
    },
    [],
  );

  const completed = useMemo(
    () => items.filter((item) => item.complete).length,
    [items],
  );
  const total = items.length;
  const isComplete = completed === total && total > 0;

  const value = useMemo<ProfileCompletionValue>(
    () => ({ items, completed, total, isComplete, setItemComplete }),
    [items, completed, total, isComplete, setItemComplete],
  );

  return (
    <ProfileCompletionContext.Provider value={value}>
      {children}
    </ProfileCompletionContext.Provider>
  );
}

export function useProfileCompletion() {
  const context = useContext(ProfileCompletionContext);
  if (!context) {
    throw new Error(
      "useProfileCompletion muss innerhalb eines ProfileCompletionProvider verwendet werden.",
    );
  }
  return context;
}
