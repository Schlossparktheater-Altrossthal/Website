"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DepartmentSelectOption = {
  label: string;
  value: string;
};

interface DepartmentSelectProps {
  options: DepartmentSelectOption[];
  selectedValue?: string;
}

export function DepartmentSelect({ options, selectedValue }: DepartmentSelectProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === "none") {
      params.delete("department");
    } else {
      params.set("department", value);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="department-select">Gewerk</Label>
      <Select onValueChange={handleChange} value={selectedValue ?? "none"}>
        <SelectTrigger id="department-select" className="w-full">
          <SelectValue placeholder="Bitte wählen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Bitte wählen</SelectItem>
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
