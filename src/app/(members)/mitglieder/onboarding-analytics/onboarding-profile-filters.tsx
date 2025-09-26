"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_VALUE = "__all__";

const statusOptions = [
  { value: DEFAULT_VALUE, label: "Alle Stati" },
  { value: "completed", label: "Abgeschlossen" },
  { value: "open", label: "Offen" },
];

const focusOptions = [
  { value: DEFAULT_VALUE, label: "Alle Schwerpunkte" },
  { value: "acting", label: "Schauspiel" },
  { value: "tech", label: "Gewerke" },
  { value: "both", label: "Hybrid" },
];

const membershipOptions = [
  { value: DEFAULT_VALUE, label: "Alle Personen" },
  { value: "member", label: "Bereits Mitglied" },
  { value: "prospect", label: "Noch kein Mitglied" },
];

const domainOptions = [
  { value: DEFAULT_VALUE, label: "Alle Präferenzen" },
  { value: "acting", label: "Nur Schauspiel-Wünsche" },
  { value: "crew", label: "Nur Gewerke-Wünsche" },
  { value: "both", label: "Schauspiel & Gewerke" },
  { value: "none", label: "Keine Wünsche hinterlegt" },
];

type OnboardingProfileFiltersProps = {
  status: string;
  focus: string;
  membership: string;
  domain: string;
};

export function OnboardingProfileFilters({
  status,
  focus,
  membership,
  domain,
}: OnboardingProfileFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === DEFAULT_VALUE) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    startTransition(() => {
      const query = params.toString();
      const targetPath = pathname ?? "/";
      router.replace(query ? `${targetPath}?${query}` : targetPath, { scroll: false });
    });
  };

  const handleReset = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("status");
    params.delete("focus");
    params.delete("membership");
    params.delete("domain");

    startTransition(() => {
      const query = params.toString();
      const targetPath = pathname ?? "/";
      router.replace(query ? `${targetPath}?${query}` : targetPath, { scroll: false });
    });
  };

  const disabled = isPending;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Filter für Profile</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={disabled}
          className="h-8 px-2 text-xs font-medium"
        >
          Zurücksetzen
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          label="Status"
          value={status}
          options={statusOptions}
          onChange={(value) => handleChange("status", value)}
          disabled={disabled}
        />
        <FilterSelect
          label="Schwerpunkt"
          value={focus}
          options={focusOptions}
          onChange={(value) => handleChange("focus", value)}
          disabled={disabled}
        />
        <FilterSelect
          label="Mitgliedschaft"
          value={membership}
          options={membershipOptions}
          onChange={(value) => handleChange("membership", value)}
          disabled={disabled}
        />
        <FilterSelect
          label="Präferenz-Typ"
          value={domain}
          options={domainOptions}
          onChange={(value) => handleChange("domain", value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

function FilterSelect({ label, value, options, onChange, disabled }: FilterSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
