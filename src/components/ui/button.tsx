"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-base motion-scale",
  {
    variants: {
      variant: {
        default: "btn-filled btn-tone-primary",
        primary: "btn-filled btn-tone-primary",
        secondary: "btn-filled btn-tone-secondary",
        accent: "btn-filled btn-tone-accent",
        outline: "btn-outlined btn-tone-primary",
        ghost: "btn-ghost btn-tone-primary",
        subtle: "btn-subtle",
        link: "h-auto gap-1 bg-transparent p-0 text-primary underline underline-offset-4 decoration-primary/60 hover:text-primary/90 hover:decoration-primary",
        destructive: "btn-filled btn-tone-destructive",
        success: "btn-filled btn-tone-success",
        info: "btn-filled btn-tone-info",
      },
      size: {
        xs: "h-8 px-3 text-xs",
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
