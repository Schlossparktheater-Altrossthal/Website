import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// `default`/`md` entspricht dem bisherigen Aussehen; kompakte Ansichten nutzen `sm`,
// Listen mit eigenen Zeilenabständen `flush` (kein Innenabstand).
const cardVariants = cva("rounded-lg border text-card-foreground", {
  variants: {
    variant: {
      default: "border-border/50 bg-card/60 shadow-sm backdrop-blur",
      plain: "border-border/60 bg-card shadow-sm",
      muted: "border-transparent bg-muted/40",
      accent: "border-primary/25 bg-primary/5",
      ghost: "border-transparent bg-transparent",
    },
    size: {
      flush: "p-0",
      sm: "p-3",
      md: "p-4",
      lg: "p-6",
    },
  },
  defaultVariants: { variant: "default", size: "md" },
});

export type CardProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, size, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, size }), className)} {...props} />;
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

export { cardVariants };
