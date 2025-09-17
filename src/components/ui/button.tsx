"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none px-4 h-10 shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-95",
        outline: "border border-border hover:bg-accent/30",
        ghost: "hover:bg-accent/30",
      },
      size: { sm: "h-9 px-3", md: "h-10 px-4", lg: "h-11 px-6" },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, children, ...rest }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      ...rest,
      className: cn(classes, child.props?.className),
    });
  }
  if (asChild) {
    return (
      <button className={classes} {...rest}>
        {children}
      </button>
    );
  }
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
