"use client";

import * as React from "react";

import { offlineDb } from "./db";
import { useOfflineSync as useOfflineStorage } from "./storage";
import type { OfflineScope, PendingEvent, PendingEventInput } from "./types";
import {
  OfflineSyncContext,
  SyncClient,
  SyncError,
  type BootstrapResult,
  type FlushResult,
  type OfflineSyncContextValue,
  type PullResult,
  type SyncScopeState,
} from "./sync-client";

function createInitialScopeState(): Record<OfflineScope, SyncScopeState> {
  return {
    inventory: {
      status: "idle",
      lastSyncedAt: null,
      lastError: null,
      lastServerSeq: 0,
    },
    tickets: {
      status: "idle",
      lastSyncedAt: null,
      lastError: null,
      lastServerSeq: 0,
    },
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof SyncError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function refreshScopeFromDb(scope: OfflineScope) {
  if (!offlineDb) {
    return null;
  }

  const state = await offlineDb.syncState.get(scope);
  return state ?? null;
}

export function OfflineSyncStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const storage = useOfflineStorage();
  const isReady = storage.isSupported && storage.isReady;
  const [client] = React.useState(() => new SyncClient());
  const [scopes, setScopes] = React.useState(createInitialScopeState);

  const updateScope = React.useCallback(
    (scope: OfflineScope, updater: (state: SyncScopeState) => SyncScopeState) => {
      setScopes((previous) => ({
        ...previous,
        [scope]: updater(previous[scope]),
      }));
    },
    [],
  );

  const ensureReady = React.useCallback(
    (scope: OfflineScope) => {
      if (!isReady) {
        throw new SyncError(
          "Offline persistence is not ready yet.",
          "unsupported",
          scope,
        );
      }
    },
    [isReady],
  );

  const syncScopeStateFromDb = React.useCallback(
    async (scope: OfflineScope) => {
      if (!isReady) {
        return;
      }

      const record = await refreshScopeFromDb(scope);

      if (!record) {
        return;
      }

      updateScope(scope, (previous) => ({
        ...previous,
        lastServerSeq: record.lastServerSeq,
        lastSyncedAt: record.updatedAt ?? previous.lastSyncedAt,
      }));
    },
    [isReady, updateScope],
  );

  React.useEffect(() => {
    if (!isReady) {
      return;
    }

    let cancelled = false;

    const loadInitialState = async () => {
      const scopesToLoad: OfflineScope[] = ["inventory", "tickets"];

      for (const scope of scopesToLoad) {
        const record = await refreshScopeFromDb(scope);

        if (cancelled || !record) {
          continue;
        }

        updateScope(scope, (previous) => ({
          ...previous,
          lastServerSeq: record.lastServerSeq,
          lastSyncedAt: record.updatedAt ?? previous.lastSyncedAt,
          lastError: null,
        }));
      }
    };

    void loadInitialState();

    return () => {
      cancelled = true;
    };
  }, [isReady, updateScope]);

  const markStatus = React.useCallback(
    (scope: OfflineScope, status: SyncScopeState["status"], error?: string | null) => {
      updateScope(scope, (previous) => ({
        ...previous,
        status,
        ...(typeof error !== "undefined" ? { lastError: error } : {}),
      }));
    },
    [updateScope],
  );

  const bootstrap = React.useCallback(
    async (scope: OfflineScope): Promise<BootstrapResult> => {
      ensureReady(scope);
      markStatus(scope, "bootstrapping", null);

      try {
        const result = await client.bootstrap(scope);

        updateScope(scope, (previous) => ({
          ...previous,
          status: "idle",
          lastError: null,
          lastSyncedAt: result.capturedAt,
          lastServerSeq: result.serverSeq,
        }));

        return result;
      } catch (error) {
        const message = toErrorMessage(error);
        markStatus(scope, "error", message);
        throw error;
      }
    },
    [client, ensureReady, markStatus, updateScope],
  );

  const flush = React.useCallback(
    async (scope: OfflineScope): Promise<FlushResult> => {
      ensureReady(scope);
      markStatus(scope, "flushing", null);

      try {
        const result = await client.flush(scope);
        updateScope(scope, (previous) => ({
          ...previous,
          status: "idle",
          lastError: null,
          lastSyncedAt: result.completedAt,
          lastServerSeq: result.serverSeq,
        }));
        await syncScopeStateFromDb(scope);
        return result;
      } catch (error) {
        const message = toErrorMessage(error);
        markStatus(scope, "error", message);
        throw error;
      }
    },
    [client, ensureReady, markStatus, syncScopeStateFromDb, updateScope],
  );

  const pull = React.useCallback(
    async (scope: OfflineScope): Promise<PullResult> => {
      ensureReady(scope);
      markStatus(scope, "pulling", null);

      try {
        const result = await client.pull(scope);
        updateScope(scope, (previous) => ({
          ...previous,
          status: "idle",
          lastError: null,
          lastSyncedAt: result.completedAt,
          lastServerSeq: result.serverSeq,
        }));
        await syncScopeStateFromDb(scope);
        return result;
      } catch (error) {
        const message = toErrorMessage(error);
        markStatus(scope, "error", message);
        throw error;
      }
    },
    [client, ensureReady, markStatus, syncScopeStateFromDb, updateScope],
  );

  const enqueue = React.useCallback(
    async (event: PendingEventInput): Promise<PendingEvent> => {
      const scope = client.determineScopeFromEvent(event);
      ensureReady(scope);

      try {
        const pending = await client.enqueue(event);
        updateScope(scope, (previous) => ({
          ...previous,
          lastError: null,
        }));
        return pending;
      } catch (error) {
        const message = toErrorMessage(error);
        markStatus(scope, "error", message);
        throw error;
      }
    },
    [client, ensureReady, markStatus, updateScope],
  );

  React.useEffect(() => {
    if (!isReady) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const handleOnline = () => {
      void Promise.all([flush("inventory"), flush("tickets")]).catch((error) => {
        console.warn("Failed to flush offline events after going online", error);
      });
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flush, isReady]);

  const isSyncing = React.useMemo(
    () =>
      Object.values(scopes).some((scopeState) =>
        ["bootstrapping", "flushing", "pulling"].includes(scopeState.status),
      ),
    [scopes],
  );

  const value = React.useMemo<OfflineSyncContextValue>(
    () => ({
      client,
      scopes,
      bootstrap,
      flush,
      pull,
      enqueue,
      isSyncing,
    }),
    [bootstrap, client, enqueue, flush, isSyncing, pull, scopes],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncClient() {
  const context = React.useContext(OfflineSyncContext);

  if (!context) {
    throw new Error(
      "useOfflineSyncClient must be used within an OfflineSyncStatusProvider.",
    );
  }

  return context;
}
