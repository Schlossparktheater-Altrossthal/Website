"use client";

import * as React from "react";
import { Workbox } from "workbox-window";
import { toast } from "sonner";

import { useOfflineSyncClient } from "@/lib/offline/hooks";
import type { OfflineScope } from "@/lib/offline/types";

const SERVICE_WORKER_URL = "/service-worker.js";
const OFFLINE_SYNC_TAG = "workbox-background-sync:offline-events";
const OFFLINE_SCOPES: OfflineScope[] = ["tickets"];

type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
};

export type PwaInstallState = {
  /** Läuft bereits als installierte App (Home-Bildschirm / eigenes Fenster). */
  standalone: boolean;
  /** Der Browser bietet eine Installation an (Chrome, Edge, Android). */
  canPrompt: boolean;
  /** iOS/iPadOS Safari: Installation nur über „Teilen → Zum Home-Bildschirm“. */
  iosManual: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

const PwaInstallContext = React.createContext<PwaInstallState>({
  standalone: false,
  canPrompt: false,
  iosManual: false,
  promptInstall: async () => "unavailable",
});

/** Installationsstatus der App, z. B. für den Hinweis im Dashboard. */
export function usePwaInstall() {
  return React.useContext(PwaInstallContext);
}

function detectStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function detectIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && window.navigator.maxTouchPoints > 1);
  // Andere Browser auf iOS (Chrome, Firefox) können nicht zum Home-Bildschirm hinzufügen.
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

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
  const [canPrompt, setCanPrompt] = React.useState(false);
  const [standalone, setStandalone] = React.useState(false);
  const [iosManual, setIosManual] = React.useState(false);
  const updateToastId = React.useRef<string | number | null>(null);
  const hadControllerRef = React.useRef(false);
  const shouldReloadOnControllingRef = React.useRef(false);

  const requestFlush = React.useCallback(() => {
    void flushAllScopes(flush, OFFLINE_SCOPES);
  }, [flush]);

  React.useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => {
      const isStandalone = detectStandalone();
      setStandalone(isStandalone);
      setIosManual(!isStandalone && detectIosSafari());
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const promptInstall = React.useCallback(async () => {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent) return "unavailable" as const;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      return choice.outcome;
    } catch (error) {
      console.error("Installation prompt failed", error);
      return "unavailable" as const;
    } finally {
      deferredPrompt.current = null;
      setCanPrompt(false);
    }
  }, []);

  const installState = React.useMemo<PwaInstallState>(
    () => ({ standalone, canPrompt, iosManual, promptInstall }),
    [standalone, canPrompt, iosManual, promptInstall],
  );

  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let wb: Workbox | null = null;

    hadControllerRef.current = Boolean(navigator.serviceWorker.controller);
    shouldReloadOnControllingRef.current = hadControllerRef.current;

    const handleServiceWorkerMessage = (event: { data: MessageEvent["data"] }) => {
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

          shouldReloadOnControllingRef.current = true;

          void wb
            .messageSW({ type: "SKIP_WAITING" })
            .catch((error) => console.error("Failed to activate new service worker", error));
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

          if (!shouldReloadOnControllingRef.current && !hadControllerRef.current) {
            return;
          }

          window.location.reload();
        });

        wb.addEventListener("message", (event) => {
          handleServiceWorkerMessage(event);
        });

        await wb.register();
      } catch (error) {
        // Der Service Worker ist ein Progressive Enhancement. Ein Registrierungsfehler
        // (z. B. geschützte Umgebungen oder fehlende Workbox-Assets) ist nicht kritisch.
        if (process.env.NODE_ENV !== "production") {
          console.warn("Service Worker registration failed", error);
        }
      }
    };

    void registerWorker();

    // Kein automatischer Dialog: der Hinweis im Dashboard bietet die Installation an.
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };

    const handleAppInstalled = () => {
      deferredPrompt.current = null;
      setCanPrompt(false);
      toast.success("App installiert", { duration: 3000 });
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
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      if (updateToastId.current) {
        toast.dismiss(updateToastId.current);
        updateToastId.current = null;
      }
    };
  }, [requestFlush]);

  return React.createElement(PwaInstallContext.Provider, { value: installState }, children);
}
