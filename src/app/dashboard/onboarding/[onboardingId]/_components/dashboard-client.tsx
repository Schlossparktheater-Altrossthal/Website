"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OnboardingDashboardData, OnboardingSummary } from "@/lib/onboarding/dashboard-schemas";
import { useRealtime } from "@/hooks/useRealtime";

import { AllocationTab } from "./allocation-tab";
import { GlobalOverviewTab } from "./global-tab";
import { HeaderBar } from "./header-bar";
import { HistoryTab } from "./history-tab";
import { MembersOverviewTab } from "./members-overview-tab";
import { RankingTab } from "./ranking-tab";

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
  detailHrefTemplate?: string;
  isOffline?: boolean;
};

export function DashboardClient({
  initialData,
  onboardings,
  navigateHrefTemplate = "/dashboard/onboarding/%s",
  detailHrefTemplate = "/dashboard/onboarding/%s/talente/%s",
  isOffline = false,
}: DashboardClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { socket, joinRoom, leaveRoom } = useRealtime();
  const [selectedOnboarding, setSelectedOnboarding] = useState(initialData.onboarding.id);
  const [tabValue, setTabValue] = useState<"global" | "members" | "ranking" | "allocation" | "history">("global");
  const [isPending, startTransition] = useTransition();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const offline = isOffline;

  useEffect(() => {
    setSelectedOnboarding(initialData.onboarding.id);
    queryClient.setQueryData(dashboardQueryKey(initialData.onboarding.id), initialData);
  }, [initialData, queryClient]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: dashboardQueryKey(selectedOnboarding),
    queryFn: () => fetchDashboard(selectedOnboarding),
    initialData: selectedOnboarding === initialData.onboarding.id ? initialData : undefined,
    staleTime: 30_000,
    enabled: !offline,
    refetchInterval: offline ? false : 60_000,
  });

  useEffect(() => {
    if (!selectedOnboarding || offline) {
      return;
    }
    const room = `onboarding_${selectedOnboarding}` as const;
    joinRoom(room);
    return () => {
      leaveRoom(room);
    };
  }, [joinRoom, leaveRoom, offline, selectedOnboarding]);

  useEffect(() => {
    if (!socket || offline) return;
    const handleUpdate = (event: { onboardingId: string; dashboard: OnboardingDashboardData }) => {
      queryClient.setQueryData(dashboardQueryKey(event.onboardingId), event.dashboard);
    };
    socket.on("onboarding_dashboard_update", handleUpdate);
    return () => {
      socket.off("onboarding_dashboard_update", handleUpdate);
    };
  }, [socket, offline, queryClient]);

  const currentData = data ?? initialData;

  useEffect(() => {
    if (tabValue === "history" && !(currentData.history && currentData.history.length > 0)) {
      setTabValue("global");
    }
  }, [tabValue, currentData.history]);

  const handleSelect = (nextId: string) => {
    if (!nextId || offline) return;
    setSelectedOnboarding(nextId);
    startTransition(() => {
      const targetHref = navigateHrefTemplate.includes("%s")
        ? navigateHrefTemplate.replace("%s", nextId)
        : `${navigateHrefTemplate}${navigateHrefTemplate.endsWith("/") ? "" : "/"}${nextId}`;
      router.replace(targetHref);
    });
  };

  const handleExportPdf = useCallback(async () => {
    if (!selectedOnboarding || isExportingPdf || offline) {
      return;
    }
    setIsExportingPdf(true);
    try {
      const response = await fetch(`/dashboard/onboarding/${selectedOnboarding}/statistics`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const fallbackName = `onboarding-statistik-${selectedOnboarding}.pdf`;
      const disposition = response.headers.get("Content-Disposition");
      let filename = fallbackName;
      if (disposition) {
        const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utfMatch?.[1]) {
          try {
            filename = decodeURIComponent(utfMatch[1]);
          } catch {
            filename = utfMatch[1];
          }
        } else {
          const simpleMatch = disposition.match(/filename="?([^";]+)"?/i);
          if (simpleMatch?.[1]) {
            filename = simpleMatch[1];
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Onboarding-Statistik exportiert.");
    } catch (error) {
      console.error("Failed to export onboarding statistics", error);
      toast.error("PDF konnte nicht erstellt werden.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [isExportingPdf, offline, selectedOnboarding]);

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
        isRefreshing={offline ? false : isFetching || isPending}
        onSelect={handleSelect}
        onRefresh={!offline ? () => void refetch() : undefined}
        onExportPdf={!offline ? handleExportPdf : undefined}
        isExportingPdf={isExportingPdf}
        isOffline={offline}
      />
      <Tabs
        value={tabValue}
        onValueChange={(value) => {
          if (offline) return;
          setTabValue(value as typeof tabValue);
        }}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="global" disabled={offline}>
            Global
          </TabsTrigger>
          <TabsTrigger value="members" disabled={offline}>
            Mitglieder
          </TabsTrigger>
          <TabsTrigger value="ranking" disabled={offline}>
            Ranking
          </TabsTrigger>
          <TabsTrigger value="allocation" disabled={offline}>
            Zuteilung
          </TabsTrigger>
          {historyAvailable ? (
            <TabsTrigger value="history" disabled={offline}>
              Historie
            </TabsTrigger>
          ) : null}
        </TabsList>
        <AnimatePresence mode="wait">
          <TabsContent key="global" value="global" className="space-y-6">
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
          <TabsContent key="members" value="members" className="space-y-6">
            <motion.div
              key={`${currentData.onboarding.id}-members`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <MembersOverviewTab members={currentData.membersOverview} />
            </motion.div>
          </TabsContent>
          <TabsContent key="ranking" value="ranking" className="space-y-6">
            <motion.div
              key={`${currentData.onboarding.id}-ranking`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <RankingTab
                ranking={currentData.ranking}
                onboardingId={currentData.onboarding.id}
                detailHrefTemplate={detailHrefTemplate}
              />
            </motion.div>
          </TabsContent>
          <TabsContent key="allocation" value="allocation" className="space-y-6">
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
            <TabsContent key="history" value="history" className="space-y-6">
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
