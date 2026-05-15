"use client";

import { useEffect, useState } from "react";

const COOKIE_NAME = "cookie_consent";
const COOKIE_VALUE = "true";
const COOKIE_MAX_AGE_DAYS = 132;

function hasConsentCookie() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .some((entry) => entry === `${COOKIE_NAME}=${COOKIE_VALUE}`);
}

function setConsentCookie() {
  const maxAgeSeconds = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${COOKIE_VALUE}; max-age=${maxAgeSeconds}; path=/; samesite=lax`;
}

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(!hasConsentCookie());
  }, []);

  const handleAccept = () => {
    setConsentCookie();
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          Diese Website verwendet technisch notwendige Cookies für den Login-Bereich. Kein Tracking, keine
          Werbung.
        </p>
        <button
          type="button"
          onClick={handleAccept}
          className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Cookie-Hinweis bestätigen"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}
