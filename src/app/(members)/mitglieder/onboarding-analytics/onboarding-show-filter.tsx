"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OnboardingShowFilterOption = {
  value: string;
  label: string;
};

type OnboardingShowFilterProps = {
  options: OnboardingShowFilterOption[];
  value: string;
};

export function OnboardingShowFilter({ options, value }: OnboardingShowFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleChange = (nextValue: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (!nextValue) {
      params.delete("show");
    } else {
      params.set("show", nextValue);
    }

    startTransition(() => {
      const query = params.toString();
      const targetPath = pathname ?? "/";
      router.replace(query ? `${targetPath}?${query}` : targetPath, { scroll: false });
    });
  };

  const isDisabled = options.length <= 1;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Onboarding auswählen
      </span>
      <Select value={value} onValueChange={handleChange} disabled={isDisabled || isPending}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Alle Onboardings" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value || "__all"} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
