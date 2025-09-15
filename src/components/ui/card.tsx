import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 p-4 bg-card/60 backdrop-blur text-card-foreground shadow-sm",
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
