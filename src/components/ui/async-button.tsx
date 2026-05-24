"use client";

import { Button } from "@/components/ui/button";
import { LoadingIcon } from "@/components/ui/action-icons";
import type { AsyncButtonProps } from "@/lib/ui-standards";

export function AsyncButton({
  isLoading,
  loadingText,
  children,
  disabled,
  ...props
}: AsyncButtonProps) {
  return (
    <Button disabled={disabled || isLoading} data-state={isLoading ? "loading" : undefined} {...props}>
      {isLoading ? (
        <>
          <LoadingIcon className="h-4 w-4 animate-spin" aria-hidden />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
