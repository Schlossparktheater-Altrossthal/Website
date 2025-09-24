"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import * as React from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { FrontendEditingProvider } from "@/components/frontend-editing/frontend-editing-provider";
import { RealtimeProvider } from "@/hooks/useRealtime";
import { OfflineSyncStatusProvider } from "@/lib/offline/hooks";
import { OfflineSyncProvider as OfflineStorageProvider } from "@/lib/offline/storage";

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  const [client] = React.useState(() => new QueryClient());
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={client}>
        <OfflineStorageProvider>
          <OfflineSyncStatusProvider>
            <RealtimeProvider>
              <FrontendEditingProvider>
                {children}
                <Toaster
                  richColors
                  position="top-right"
                  expand={true}
                  visibleToasts={5}
                  gap={8}
                />
              </FrontendEditingProvider>
            </RealtimeProvider>
          </OfflineSyncStatusProvider>
        </OfflineStorageProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
