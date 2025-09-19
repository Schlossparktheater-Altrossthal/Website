"use client";

import Image from "next/image";
import { getGravatarUrl } from "@/lib/gravatar";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import type { AvatarSource } from "@prisma/client";

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

function computeInitials(name?: string | null, email?: string | null): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return trimmedName.slice(0, 2).toUpperCase();
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    const local = trimmedEmail.split("@")[0];
    return local.slice(0, 2).toUpperCase() || trimmedEmail[0]?.toUpperCase() || "?";
  }
  return "?";
}

export type UserAvatarProps = {
  userId?: string;
  email?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  loading?: "eager" | "lazy";
  style?: CSSProperties;
  avatarSource?: AvatarSource | string | null;
  avatarUpdatedAt?: string | number | Date | null;
  previewUrl?: string | null;
};

export function UserAvatar({
  userId,
  email,
  name,
  size = 32,
  className,
  loading = "lazy",
  style,
  avatarSource,
  avatarUpdatedAt,
  previewUrl,
}: UserAvatarProps) {
  const displaySize = Math.max(1, Math.round(size));
  const label = name?.trim() || email?.trim() || undefined;
  const normalized = normalizeSource(avatarSource);
  const effectiveSource = normalized ?? (previewUrl ? "UPLOAD" : email ? "GRAVATAR" : "INITIALS");
  const version = getVersionKey(avatarUpdatedAt);
  const sharedStyle: CSSProperties = { width: displaySize, height: displaySize, ...style };

  if (effectiveSource === "UPLOAD") {
    const uploadSrc = previewUrl ?? (userId ? `/api/users/${userId}/avatar${version ? `?v=${version}` : ""}` : undefined);
    if (uploadSrc) {
      return (
        <Image
          src={uploadSrc}
          alt={label ? `Avatar von ${label}` : "Avatar"}
          title={label}
          width={displaySize}
          height={displaySize}
          loading={loading}
          priority={loading === "eager"}
          sizes={`${displaySize}px`}
          className={cn("inline-block rounded-full bg-muted object-cover", className)}
          style={sharedStyle}
          draggable={false}
        />
      );
    }
  }

  if (effectiveSource === "GRAVATAR") {
    const gravatarSize = Math.max(32, Math.min(2048, displaySize * 2));
    const src = getGravatarUrl(email, { size: gravatarSize });
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
        className={cn("inline-block rounded-full bg-muted object-cover", className)}
        style={sharedStyle}
        draggable={false}
      />
    );
  }

  const initials = computeInitials(name, email);
  return (
    <div
      role="img"
      aria-label={label ? `Avatar von ${label}` : "Avatar"}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-muted text-foreground/80",
        "font-medium uppercase",
        className,
      )}
      style={{
        ...sharedStyle,
        fontSize: Math.max(12, Math.round(displaySize * 0.45)),
        letterSpacing: "0.05em",
      }}
    >
      {initials}
    </div>
  );
}
