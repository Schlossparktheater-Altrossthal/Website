"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getGravatarUrl } from "@/lib/gravatar";
import { cn } from "@/lib/utils";
import { getNameInitials, getUserDisplayName } from "@/lib/names";
import type { CSSProperties } from "react";

export type AvatarSource = "GRAVATAR" | "UPLOAD" | "INITIALS";

type NormalizedSource = "GRAVATAR" | "UPLOAD" | "INITIALS";

function normalizeSource(source?: AvatarSource | string | null): NormalizedSource | null {
  if (!source) return null;
  const normalized = source.toString().trim().toUpperCase();
  if (normalized === "GRAVATAR" || normalized === "UPLOAD" || normalized === "INITIALS") {
    return normalized as NormalizedSource;
  }
  return null;
}

function getVersionKey(value?: string | number | Date | null): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return String(Math.round(value));
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? undefined : String(time);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : String(parsed);
}

export type UserAvatarProps = {
  userId?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  loading?: "eager" | "lazy";
  style?: CSSProperties;
  avatarSource?: AvatarSource | string | null;
  avatarUpdatedAt?: string | number | Date | null;
  previewUrl?: string | null;
};

export default function UserAvatar({
  userId,
  email,
  firstName,
  lastName,
  name,
  size = 40,
  className,
  loading = "lazy",
  style,
  avatarSource,
  avatarUpdatedAt,
  previewUrl,
}: UserAvatarProps) {
  const displaySize = Math.max(1, Math.round(size));
  const trimmedEmail = email?.trim() || undefined;
  const label = getUserDisplayName({ firstName, lastName, name, email }, "") || undefined;
  const normalized = normalizeSource(avatarSource);

  const [gravatarFailed, setGravatarFailed] = useState(false);

  useEffect(() => {
    setGravatarFailed(false);
  }, [normalized, trimmedEmail]);

  let effectiveSource = normalized ?? (previewUrl ? "UPLOAD" : trimmedEmail ? "GRAVATAR" : "INITIALS");
  if (effectiveSource === "GRAVATAR" && !trimmedEmail) {
    effectiveSource = "INITIALS";
  }
  const version = getVersionKey(avatarUpdatedAt);
  const sharedStyle: CSSProperties = { width: displaySize, height: displaySize, ...style };

  if (effectiveSource === "UPLOAD") {
    const uploadSrc = previewUrl ?? (userId ? `/api/users/${userId}/avatar${version ? `?v=${version}` : ""}` : undefined);
    if (uploadSrc) {
      return (
        <Image
          unoptimized
          src={uploadSrc}
          alt={label ? `Avatar von ${label}` : "Avatar"}
          title={label}
          width={displaySize}
          height={displaySize}
          loading={loading}
          sizes={`${displaySize}px`}
          className={cn("inline-block rounded-full border border-border bg-muted object-cover", className)}
          style={sharedStyle}
          draggable={false}
        />
      );
    }
  }

  if (effectiveSource === "GRAVATAR" && trimmedEmail && !gravatarFailed) {
    const gravatarSize = Math.max(32, Math.min(2048, displaySize * 2));
    const src = getGravatarUrl(trimmedEmail, { size: gravatarSize, defaultImage: "404" });
    return (
      <Image
        src={src}
        alt={label ? `Avatar von ${label}` : "Avatar"}
        title={label}
        width={displaySize}
        height={displaySize}
        loading={loading}
        priority={loading === "eager"}
        sizes={`${displaySize}px`}
        className={cn("inline-block rounded-full border border-border bg-muted object-cover", className)}
        style={sharedStyle}
        draggable={false}
        onError={() => setGravatarFailed(true)}
      />
    );
  }

  // Default to initials (or when Gravatar failed or no source available)
  const initials = getNameInitials({ firstName, lastName, name, email });
  return (
    <div
      className={cn("inline-flex items-center justify-center rounded-full border border-border bg-muted", className)}
      style={{ width: displaySize, height: displaySize, fontSize: Math.max(10, displaySize * 0.4), ...style }}
      aria-label={label ? `Avatar von ${label}` : "Avatar"}
      title={label}
      draggable={false}
    >
      {initials}
    </div>
  );
}

// Zusätzlich zum Default-Export auch als benannten Export verfügbar machen,
// damit `import { UserAvatar } from "@/components/user-avatar"` funktioniert.
export { UserAvatar };
