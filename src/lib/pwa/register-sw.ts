"use client";

import * as React from "react";
import { Workbox } from "workbox-window";
import { toast } from "sonner";

import { useOfflineSyncClient } from "@/lib/offline/hooks";
import type { OfflineScope } from "@/lib/offline/types";

const SERVICE_WORKER_URL = "/service-worker.js";
const OFFLINE_SYNC_TAG = "workbox-background-sync:offline-events";
const OFFLINE_SCOPES: OfflineScope[] = ["inventory", "tickets"];

type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
};

async function flushAllScopes(
  flush: (scope: OfflineScope) => Promise<unknown>,
  scopes: OfflineScope[],
) {
  await Promise.all(
    scopes.map((scope) =>
      flush(scope).catch((error) => {
        console.warn(`Failed to flush offline scope ${scope}`, error);
      }),
    ),
  );
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const { flush } = useOfflineSyncClient();
  const deferredPrompt = React.useRef<BeforeInstallPromptEvent | null>(null);
  const installToastId = React.useRef<string | number | null>(null);
  const updateToastId = React.useRef<string | number | null>(null);

  const requestFlush = React.useCallback(() => {
    void flushAllScopes(flush, OFFLINE_SCOPES);
  }, [flush]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let wb: Workbox | null = null;
    let isMounted = true;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const { data } = event;

      if (!data || typeof data !== "object") {
        return;
      }

      if (data.type === "offline-events:flushed") {
        toast.success("Offline-Änderungen wurden synchronisiert.");
        requestFlush();
      } else if (data.type === "offline-events:error") {
        const message =
          typeof data.message === "string"
            ? data.message
            : "Offline-Änderungen konnten nicht synchronisiert werden.";
        toast.error(message);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);

    const registerWorker = async () => {
      try {
        wb = new Workbox(SERVICE_WORKER_URL);

        const activateUpdate = () => {
          if (!wb) {
            return;
          }

          void wb
            .messageSW({ type: "SKIP_WAITING" })
            .catch((error) =>
              console.error("Failed to activate new service worker", error),
            );
        };

        wb.addEventListener("waiting", () => {
          if (updateToastId.current) {
            toast.dismiss(updateToastId.current);
          }

          updateToastId.current = toast("Update verfügbar", {
            description: "Eine neue Version der App steht bereit.",
            action: {
              label: "Aktualisieren",
              onClick: activateUpdate,
            },
          });
        });

        wb.addEventListener("controlling", () => {
          if (updateToastId.current) {
            toast.dismiss(updateToastId.current);
            updateToastId.current = null;
          }

          window.location.reload();
        });

        wb.addEventListener("message", (event) => {
          handleServiceWorkerMessage(event as unknown as MessageEvent);
        });

        await wb.register();
      } catch (error) {
        console.error("Service Worker registration failed", error);
        if (isMounted) {
          toast.error("Service Worker konnte nicht registriert werden.");
        }
      }
    };

    void registerWorker();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      deferredPrompt.current = promptEvent;

      if (installToastId.current) {
        toast.dismiss(installToastId.current);
      }

      installToastId.current = toast("App installieren?", {
        description: "Lege den Scanner auf deinem Gerät ab.",
        duration: 10000,
        action: {
          label: "Installieren",
          onClick: async () => {
            try {
              await promptEvent.prompt();
              const choice = await promptEvent.userChoice;
              if (choice.outcome !== "accepted") {
                toast.info("Installation abgebrochen.");
              }
            } catch (installError) {
              console.error("Installation prompt failed", installError);
            } finally {
              deferredPrompt.current = null;
              if (installToastId.current) {
                toast.dismiss(installToastId.current);
                installToastId.current = null;
              }
            }
          },
        },
      });
    };

    const handleAppInstalled = () => {
      deferredPrompt.current = null;
      if (installToastId.current) {
        toast.dismiss(installToastId.current);
        installToastId.current = null;
      }
      toast.success("App erfolgreich installiert.");
    };

    const handleOnline = () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: OFFLINE_SYNC_TAG });
      }
      requestFlush();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      if (updateToastId.current) {
        toast.dismiss(updateToastId.current);
        updateToastId.current = null;
      }
      if (installToastId.current) {
        toast.dismiss(installToastId.current);
        installToastId.current = null;
      }
    };
  }, [requestFlush]);

  return React.createElement(React.Fragment, null, children);
}
