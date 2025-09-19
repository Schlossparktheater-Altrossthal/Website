"use client";

import Image from "next/image";
import { getGravatarUrl } from "@/lib/gravatar";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export type UserAvatarProps = {
  email?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  loading?: "eager" | "lazy";
  style?: CSSProperties;
};

export function UserAvatar({
  email,
  name,
  size = 32,
  className,
  loading = "lazy",
  style,
}: UserAvatarProps) {
  const displaySize = Math.max(1, Math.round(size));
  const gravatarSize = Math.max(32, Math.min(2048, displaySize * 2));
  const src = getGravatarUrl(email, { size: gravatarSize });
  const label = name?.trim() || email?.trim() || undefined;

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
      style={{ width: displaySize, height: displaySize, ...style }}
    />
  );
}
