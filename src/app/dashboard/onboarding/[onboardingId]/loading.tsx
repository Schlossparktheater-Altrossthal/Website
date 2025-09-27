import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingOnboardingDashboard() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <Skeleton key={index} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
