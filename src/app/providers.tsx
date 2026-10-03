"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import * as React from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { RealtimeProvider } from "@/hooks/useRealtime";
import { PerformanceReporter } from "@/components/analytics/performance-reporter";
import { useWebVitals } from "@/hooks/useWebVitals";
import { OfflineSyncStatusProvider } from "@/lib/offline/hooks";
import { OfflineSyncProvider as OfflineStorageProvider } from "@/lib/offline/storage";
import { PwaProvider } from "@/lib/pwa/register-sw";

function WebVitalsInitializer() {
  const { data: session } = useSession();
  const analyticsSessionId = session?.analyticsSessionId ?? null;
  useWebVitals({ analyticsSessionId });
  // Immer einhängen: der Erstaufruf wird ab Hydration gemessen, nicht erst nach dem Sitzungsabruf.
  return <PerformanceReporter analyticsSessionId={analyticsSessionId} />;
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
                {children}
                <Toaster richColors position="top-right" expand={true} visibleToasts={5} gap={8} />
              </RealtimeProvider>
            </PwaProvider>
          </OfflineSyncStatusProvider>
        </OfflineStorageProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
