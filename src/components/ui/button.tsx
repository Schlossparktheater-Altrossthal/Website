"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold leading-none ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 data-[state=loading]:cursor-progress",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_10px_30px_-15px_rgba(94,58,255,0.65)] hover:bg-primary/90",
        primary:
          "bg-primary text-primary-foreground shadow-[0_10px_30px_-15px_rgba(94,58,255,0.65)] hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_8px_26px_-16px_rgba(201,148,58,0.55)] hover:bg-secondary/90",
        accent:
          "bg-accent text-accent-foreground shadow-[0_8px_22px_-14px_rgba(45,212,191,0.55)] hover:bg-accent/90",
        outline:
          "border border-border bg-transparent text-foreground hover:border-primary/50 hover:text-primary",
        ghost:
          "bg-transparent text-foreground hover:bg-muted/40 hover:text-foreground",
        subtle:
          "bg-muted text-foreground/90 hover:bg-muted/70",
        link:
          "text-primary underline underline-offset-4 decoration-primary/60 hover:text-primary/90 hover:decoration-primary",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40",
        success:
          "bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/40",
        info:
          "bg-info text-info-foreground hover:bg-info/90 focus-visible:ring-info/40",
      },
      size: {
        xs: "h-8 rounded-md px-3 text-xs",
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        xl: "h-12 px-7 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
