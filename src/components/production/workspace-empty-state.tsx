import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
