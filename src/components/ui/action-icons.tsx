"use client";

import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import type * as React from "react";

export const EditIcon = ({ className = "w-4 h-4", ...props }: React.SVGProps<SVGSVGElement>) => {
  return <Pencil className={className} aria-hidden {...props} />;
};

export function TrashIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Trash2 className={className} aria-hidden {...props} />;
}

export function MoreVerticalIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <MoreVertical className={className} aria-hidden {...props} />;
}
