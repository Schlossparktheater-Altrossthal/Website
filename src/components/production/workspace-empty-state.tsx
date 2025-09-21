import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRightCircle } from "lucide-react";

type ProductionWorkspaceEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export function ProductionWorkspaceEmptyState({
  title,
  description,
  actionLabel = "Zur Produktionsübersicht",
  actionHref = "/mitglieder/produktionen",
}: ProductionWorkspaceEmptyStateProps) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <Button asChild title={actionLabel}>
          <Link href={actionHref}>
            <ArrowRightCircle aria-hidden className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">{actionLabel}</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
