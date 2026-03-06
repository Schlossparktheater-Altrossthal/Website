"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";


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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("department", value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-2">
      <Select onValueChange={handleChange} value={selectedValue}>
        <SelectTrigger id="department-select" className="w-full">
          <SelectValue placeholder="Gewerk auswählen" />
        </SelectTrigger>
        <SelectContent>
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
