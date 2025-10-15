"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "./input";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  wrapperClassName?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, wrapperClassName, disabled, ...props }, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);

    return (
      <div className={cn("relative", wrapperClassName)}>
        <Input
          ref={ref}
          type={isPasswordVisible ? "text" : "password"}
          className={cn("pr-12", className)}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          onClick={() => setIsPasswordVisible((previous) => !previous)}
          className={cn(
            "absolute inset-y-0 right-0 flex h-full w-11 items-center justify-center rounded-r-md border-l border-border/40",
            "text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
          aria-pressed={isPasswordVisible}
          aria-label={isPasswordVisible ? "Passwort verbergen" : "Passwort anzeigen"}
          disabled={disabled}
        >
          {isPasswordVisible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

