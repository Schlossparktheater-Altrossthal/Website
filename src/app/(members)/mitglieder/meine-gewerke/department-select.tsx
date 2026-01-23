"use client";

import { useRouter } from "next/navigation";

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
  href: string;
};

interface DepartmentSelectProps {
  options: DepartmentSelectOption[];
}

export function DepartmentSelect({ options }: DepartmentSelectProps) {
  const router = useRouter();

  const handleChange = (value: string) => {
    const target = options.find((option) => option.value === value);
    if (target) {
      router.push(target.href);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="department-select">Gewerk</Label>
      <Select onValueChange={handleChange}>
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
      <p className="text-xs text-muted-foreground">
        Nach der Auswahl gelangst du direkt zum Gewerk, um Aufgaben anzulegen oder deinen Status zu prüfen.
      </p>
    </div>
  );
}
