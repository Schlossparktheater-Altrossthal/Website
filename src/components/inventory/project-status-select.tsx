"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setProjectStatusAction } from "@/app/(members)/mitglieder/lager/actions/projects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectStatus,
} from "@/lib/inventory/project-constants";

export function ProjectStatusSelect({ id, status }: { id: string; status: ProjectStatus }) {
  const router = useRouter();
  const [value, setValue] = React.useState(status);
  return (
    <Select
      value={value}
      onValueChange={async (next) => {
        const previous = value;
        setValue(next as ProjectStatus);
        const result = await setProjectStatusAction(id, next);
        if (!result.ok) {
          setValue(previous);
          toast.error(result.error);
          return;
        }
        router.refresh();
      }}
    >
      <SelectTrigger aria-label="Status" className="h-9 w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STATUSES.map((entry) => (
          <SelectItem key={entry} value={entry}>
            {PROJECT_STATUS_LABELS[entry]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
