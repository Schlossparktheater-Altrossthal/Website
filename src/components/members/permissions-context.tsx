"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

const EMPTY_PERMISSIONS: readonly string[] = [];

const MembersPermissionsContext = createContext<readonly string[]>(EMPTY_PERMISSIONS);

interface MembersPermissionsProviderProps {
  permissions?: readonly string[];
  children: ReactNode;
}

export function MembersPermissionsProvider({
  permissions,
  children,
}: MembersPermissionsProviderProps) {
  const value = useMemo(
    () => (permissions ? permissions.slice() : EMPTY_PERMISSIONS),
    [permissions],
  );

  return (
    <MembersPermissionsContext.Provider value={value}>
      {children}
    </MembersPermissionsContext.Provider>
  );
}

export function useMembersPermissions(): readonly string[] {
  return useContext(MembersPermissionsContext);
}
