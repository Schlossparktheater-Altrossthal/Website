"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BrowserNotificationPayload = NotificationOptions & {
  title: string;
  url?: string;
};

type UseBrowserNotificationsResult = {
  isSupported: boolean;
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  showNotification: (payload: BrowserNotificationPayload) => Promise<boolean>;
  registration: ServiceWorkerRegistration | null;
};

const DEFAULT_PERMISSION: NotificationPermission = "default";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function useBrowserNotifications(): UseBrowserNotificationsResult {
  const isBrowser = typeof window !== "undefined";
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (!isBrowser || !("Notification" in window)) {
      return DEFAULT_PERMISSION;
    }
    return window.Notification.permission;
  });

  const isSupported = useMemo(() => {
    return isBrowser && "Notification" in window;
  }, [isBrowser]);

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;

    const bindPermissionChange = async () => {
      if (!("permissions" in navigator) || typeof navigator.permissions?.query !== "function") {
        return;
      }

      try {
        const status = await navigator.permissions.query({
          name: "notifications" as PermissionName,
        });
        if (cancelled) {
          return;
        }
        permissionStatus = status;
        permissionStatus.onchange = () => {
          setPermission(window.Notification.permission);
        };
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[BrowserNotifications] permissions query failed", error);
        }
      }
    };

    void bindPermissionChange();

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [isSupported]);

  // Der Service Worker wird zentral im PwaProvider registriert; hier nur auf ihn warten.
  useEffect(() => {
    if (!isBrowser || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    navigator.serviceWorker.ready
      .then((readyRegistration) => {
        if (cancelled) return;
        registrationRef.current = readyRegistration;
        setRegistration(readyRegistration);
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[BrowserNotifications] service worker not ready", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isBrowser]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      return "denied";
    }

    if (window.Notification.permission === "granted") {
      setPermission("granted");
      return "granted";
    }

    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[BrowserNotifications] requestPermission failed", error);
      }
      const current = window.Notification.permission;
      setPermission(current);
      return current;
    }
  }, [isSupported]);

  const showNotification = useCallback(
    async (payload: BrowserNotificationPayload): Promise<boolean> => {
      if (!isSupported) {
        return false;
      }

      if (permission !== "granted") {
        return false;
      }

      const { title, url, data, ...rest } = payload;
      if (!title || !title.trim()) {
        return false;
      }

      const baseData = isRecord(data) ? data : {};
      const combinedData: Record<string, unknown> = { ...baseData };

      const resolvedUrl = url ?? baseData.url;
      if (typeof resolvedUrl === "string" && resolvedUrl.trim()) {
        combinedData.url = resolvedUrl;
      } else if ("url" in combinedData) {
        delete combinedData.url;
      }

      const options: NotificationOptions = {
        ...rest,
        ...(Object.keys(combinedData).length > 0 ? { data: combinedData } : {}),
      };

      const registrationInstance = registrationRef.current;

      if (registrationInstance) {
        try {
          await registrationInstance.showNotification(title, options);
          return true;
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "[BrowserNotifications] showNotification via service worker failed",
              error,
            );
          }
        }
      }

      try {
        const notification = new window.Notification(title, options);
        if (options.data && isRecord(options.data) && options.data.url) {
          const targetUrl = options.data.url;
          notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            try {
              const resolved = new URL(String(targetUrl), window.location.origin).toString();
              if (window.location.href !== resolved) {
                window.location.assign(resolved);
              }
            } catch (error) {
              if (process.env.NODE_ENV !== "production") {
                console.warn("[BrowserNotifications] failed to open notification url", error);
              }
              if (typeof targetUrl === "string") {
                window.location.href = targetUrl;
              }
            }
          };
        }
        return true;
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[BrowserNotifications] creating Notification failed", error);
        }
        return false;
      }
    },
    [isSupported, permission],
  );

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    registration,
  };
}
