import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const linkVariants = cva(
  "inline-flex items-center gap-1 text-sm leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "text-primary underline decoration-primary/60 underline-offset-4 hover:text-primary/90 hover:decoration-primary",
        subtle:
          "text-foreground underline decoration-foreground/30 underline-offset-6 hover:text-primary hover:decoration-primary/80",
        muted:
          "text-muted-foreground underline decoration-muted-foreground/40 underline-offset-6 hover:text-foreground hover:decoration-foreground/70",
        ghost:
          "text-foreground no-underline underline-offset-6 hover:text-primary hover:underline hover:decoration-primary/70",
        accent:
          "text-accent underline decoration-accent/60 underline-offset-4 hover:text-accent/90 hover:decoration-accent/90",
        button:
          "rounded-full bg-primary/10 px-3 py-1 text-primary no-underline shadow-sm hover:bg-primary/20 focus-visible:ring-primary/40",
      },
      weight: {
        medium: "font-medium",
        semibold: "font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      weight: "medium",
    },
  }
);

type TextLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  VariantProps<typeof linkVariants> & {
    asChild?: boolean;
    disabled?: boolean;
  };

const TextLink = React.forwardRef<HTMLAnchorElement, TextLinkProps>(
  (
    {
      className,
      variant,
      weight,
      asChild = false,
      disabled = false,
      tabIndex,
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : "a";

    return (
      <Component
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={cn(linkVariants({ variant, weight }), disabled && "pointer-events-none opacity-60", className)}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : tabIndex}
        {...props}
      />
    );
  }
);
TextLink.displayName = "TextLink";

export { TextLink, linkVariants };
