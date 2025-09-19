"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { RealtimeProvider } from "@/hooks/useRealtime";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient());
  return (
    <SessionProvider>
      <QueryClientProvider client={client}>
        <RealtimeProvider>
          {children}
          <Toaster 
            richColors 
            position="top-right" 
            expand={true}
            visibleToasts={5}
            gap={8}
          />
        </RealtimeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
