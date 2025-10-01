import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "surface-tinted motion-scale rounded-lg p-4 text-surface-foreground transition-shadow hover:shadow-level-2",
        className
      )}
      {...props}
    />
  );
}
export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="mb-2" {...props} />;
}
export function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className="text-lg font-semibold" {...props} />;
}
export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="space-y-2" {...props} />;
}
