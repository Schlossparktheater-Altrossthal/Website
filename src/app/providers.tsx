"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import * as React from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { FrontendEditingProvider } from "@/components/frontend-editing/frontend-editing-provider";
import { useWebVitals } from "@/hooks/useWebVitals";
import { RealtimeProvider } from "@/hooks/useRealtime";
import { OfflineSyncStatusProvider } from "@/lib/offline/hooks";
import { OfflineSyncProvider as OfflineStorageProvider } from "@/lib/offline/storage";
import { PwaProvider } from "@/lib/pwa/register-sw";

function WebVitalsInitializer({ analyticsSessionId }: { analyticsSessionId?: string | null }) {
  useWebVitals({ analyticsSessionId });
  return null;
}

export function Providers({
  children,
  session,
  syncToken,
}: {
  children: React.ReactNode;
  session?: Session | null;
  syncToken?: string | null;
}) {
  const [client] = React.useState(() => new QueryClient());
  return (
    <SessionProvider session={session}>
      <WebVitalsInitializer analyticsSessionId={session?.analyticsSessionId ?? null} />
      <QueryClientProvider client={client}>
        <OfflineStorageProvider>
          <OfflineSyncStatusProvider authToken={syncToken}>
            <PwaProvider>
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
            </PwaProvider>
          </OfflineSyncStatusProvider>
        </OfflineStorageProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
