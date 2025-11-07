import { PageHeader } from "@/components/members/page-header";

export const dynamic = "force-dynamic";

export default function BilderPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Bilder" description="Hier entsteht neues." />
      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Hier entsteht neues.
      </div>
    </div>
  );
}
