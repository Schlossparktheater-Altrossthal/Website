"use client";

import { useCallback, useEffect, useState } from "react";

type PushState = {
  /** Browser kann Web Push (Service Worker + PushManager + Notification). */
  supported: boolean;
  /** Server hat VAPID-Schlüssel. */
  configured: boolean;
  permission: NotificationPermission;
  /** Dieses Gerät hat ein Abo beim Server. */
  subscribed: boolean;
  loading: boolean;
};

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/** Gerätename für die Liste in den Einstellungen, aus dem User-Agent. */
export function describeDevice(userAgent: string) {
  const device = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Mac OS X/.test(userAgent)
          ? "Mac"
          : /Windows/.test(userAgent)
            ? "Windows"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "Gerät";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : null;
  return browser ? `${browser} (${device})` : device;
}

/**
 * Web-Push-Abo dieses Geräts. `enable()` fragt die Erlaubnis ab und meldet das Abo beim Server
 * an; ohne VAPID-Schlüssel bleibt es bei der reinen Browser-Erlaubnis.
 */
export function usePushSubscription() {
  const [state, setState] = useState<PushState>({
    supported: false,
    configured: false,
    permission: "default",
    subscribed: false,
    loading: true,
  });
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      setState((prev) => ({ ...prev, supported: false, loading: false }));
      return;
    }
    try {
      const [response, registration] = await Promise.all([
        fetch("/api/push/subscription", { cache: "no-store" }),
        navigator.serviceWorker.ready,
      ]);
      const data = response.ok
        ? ((await response.json()) as { publicKey: string | null; devices: { endpoint: string }[] })
        : { publicKey: null, devices: [] };
      const current = await registration.pushManager.getSubscription();
      setPublicKey(data.publicKey);
      setState({
        supported: true,
        configured: Boolean(data.publicKey),
        permission: Notification.permission,
        subscribed: Boolean(
          current && data.devices.some((device) => device.endpoint === current.endpoint),
        ),
        loading: false,
      });
    } catch (error) {
      console.warn("[usePushSubscription] refresh failed", error);
      setState((prev) => ({ ...prev, supported: true, loading: false }));
    }
  }, []);

  useEffect(() => {
    // Zustand kommt aus Browser-APIs und Server; erst nach dem Mount verfügbar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const enable = useCallback(async (): Promise<"subscribed" | "granted" | "denied" | "default"> => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted" || !publicKey) {
      setState((prev) => ({ ...prev, permission }));
      return permission === "granted" ? "granted" : permission;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      }));
    const response = await fetch("/api/push/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...subscription.toJSON(),
        label: describeDevice(navigator.userAgent),
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setState((prev) => ({ ...prev, permission, subscribed: true }));
    return "subscribed";
  }, [publicKey]);

  const disable = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/push/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    setState((prev) => ({ ...prev, subscribed: false }));
  }, []);

  return { ...state, enable, disable, refresh };
}
