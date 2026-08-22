"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import * as React from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { FrontendEditingProvider } from "@/components/frontend-editing/frontend-editing-provider";
import { RealtimeProvider } from "@/hooks/useRealtime";
import { useWebVitals } from "@/hooks/useWebVitals";
import { OfflineSyncStatusProvider } from "@/lib/offline/hooks";
import { OfflineSyncProvider as OfflineStorageProvider } from "@/lib/offline/storage";
import { PwaProvider } from "@/lib/pwa/register-sw";

function WebVitalsInitializer() {
  const { data: session } = useSession();
  useWebVitals({ analyticsSessionId: session?.analyticsSessionId ?? null });
  return null;
}

export function Providers({
  children,
  syncToken,
}: {
  children: React.ReactNode;
  syncToken?: string | null;
}) {
  const [client] = React.useState(() => new QueryClient());
  return (
    <SessionProvider>
      <WebVitalsInitializer />
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
