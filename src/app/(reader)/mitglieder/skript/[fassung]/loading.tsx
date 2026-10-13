import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingReader() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-3 pt-14">
      {Array.from({ length: 12 }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full" />
      ))}
    </div>
  );
}
