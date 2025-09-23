"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormCheckboxFieldProps = {
  name: string;
  defaultChecked?: boolean;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
};

export function FormCheckboxField({
  name,
  defaultChecked = false,
  label,
  description,
  className,
}: FormCheckboxFieldProps) {
  const id = React.useId();
  const [checked, setChecked] = React.useState(defaultChecked);

  return (
    <div className={cn("flex items-start gap-2 text-sm text-muted-foreground", className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(state) => setChecked(state === true)}
      />
      <div className="space-y-1">
        <Label
          htmlFor={id}
          className="cursor-pointer text-sm !font-normal leading-snug text-muted-foreground"
        >
          {label}
        </Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <input type="hidden" name={name} value={checked ? "on" : ""} />
    </div>
  );
}
