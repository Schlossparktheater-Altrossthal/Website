"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OnboardingDashboardData, OnboardingSummary } from "@/lib/onboarding/dashboard-schemas";
import { useRealtime } from "@/hooks/useRealtime";

import { AllocationTab } from "./allocation-tab";
import { GlobalOverviewTab } from "./global-tab";
import { HeaderBar } from "./header-bar";
import { HistoryTab } from "./history-tab";

function dashboardQueryKey(onboardingId: string) {
  return ["onboarding-dashboard", onboardingId] as const;
}

async function fetchDashboard(onboardingId: string): Promise<OnboardingDashboardData> {
  const response = await fetch(`/api/dashboard/onboarding/${onboardingId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Dashboard request failed (${response.status})`);
  }
  return (await response.json()) as OnboardingDashboardData;
}

type DashboardClientProps = {
  initialData: OnboardingDashboardData;
  onboardings: OnboardingSummary[];
  navigateHrefTemplate?: string;
};

export function DashboardClient({
  initialData,
  onboardings,
  navigateHrefTemplate = "/dashboard/onboarding/%s",
}: DashboardClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { socket, joinRoom, leaveRoom } = useRealtime();
  const [selectedOnboarding, setSelectedOnboarding] = useState(initialData.onboarding.id);
  const [tabValue, setTabValue] = useState<"global" | "allocation" | "history">("global");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedOnboarding(initialData.onboarding.id);
    queryClient.setQueryData(dashboardQueryKey(initialData.onboarding.id), initialData);
  }, [initialData, queryClient]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: dashboardQueryKey(selectedOnboarding),
    queryFn: () => fetchDashboard(selectedOnboarding),
    initialData: selectedOnboarding === initialData.onboarding.id ? initialData : undefined,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!selectedOnboarding) {
      return;
    }
    const room = `onboarding_${selectedOnboarding}` as const;
    joinRoom(room);
    return () => {
      leaveRoom(room);
    };
  }, [joinRoom, leaveRoom, selectedOnboarding]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (event: { onboardingId: string; dashboard: OnboardingDashboardData }) => {
      queryClient.setQueryData(dashboardQueryKey(event.onboardingId), event.dashboard);
    };
    socket.on("onboarding_dashboard_update", handleUpdate);
    return () => {
      socket.off("onboarding_dashboard_update", handleUpdate);
    };
  }, [socket, queryClient]);

  const currentData = data ?? initialData;

  useEffect(() => {
    if (tabValue === "history" && !(currentData.history && currentData.history.length > 0)) {
      setTabValue("global");
    }
  }, [tabValue, currentData.history]);

  const handleSelect = (nextId: string) => {
    if (!nextId) return;
    setSelectedOnboarding(nextId);
    startTransition(() => {
      const targetHref = navigateHrefTemplate.includes("%s")
        ? navigateHrefTemplate.replace("%s", nextId)
        : `${navigateHrefTemplate}${navigateHrefTemplate.endsWith("/") ? "" : "/"}${nextId}`;
      router.replace(targetHref);
    });
  };

  const historyAvailable = (currentData.history?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <HeaderBar
        onboardings={onboardings}
        selectedId={selectedOnboarding}
        statusLabel={currentData.onboarding.statusLabel}
        status={currentData.onboarding.status}
        timeSpan={currentData.onboarding.timeSpan}
        participants={currentData.onboarding.participants}
        isRefreshing={isFetching || isPending}
        onSelect={handleSelect}
        onRefresh={() => void refetch()}
      />
      <Tabs
        value={tabValue}
        onValueChange={(value) => setTabValue(value as typeof tabValue)}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="allocation">Zuteilung</TabsTrigger>
          {historyAvailable ? <TabsTrigger value="history">Historie</TabsTrigger> : null}
        </TabsList>
        <AnimatePresence mode="wait">
          <TabsContent value="global" className="space-y-6">
            <motion.div
              key={`${currentData.onboarding.id}-global`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <GlobalOverviewTab data={currentData.global} participants={currentData.onboarding.participants} />
            </motion.div>
          </TabsContent>
          <TabsContent value="allocation" className="space-y-6">
            <motion.div
              key={`${currentData.onboarding.id}-allocation`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <AllocationTab
                onboardingId={currentData.onboarding.id}
                allocation={currentData.allocation}
              />
            </motion.div>
          </TabsContent>
          {historyAvailable ? (
            <TabsContent value="history" className="space-y-6">
              <motion.div
                key={`${currentData.onboarding.id}-history`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <HistoryTab history={currentData.history} />
              </motion.div>
            </TabsContent>
          ) : null}
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
