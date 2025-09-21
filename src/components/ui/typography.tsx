import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const headingVariants = cva(
  "text-balance antialiased",
  {
    variants: {
      level: {
        display: "text-display",
        h1: "text-h1",
        h2: "text-h2",
        h3: "text-h3",
        h4: "text-h4",
      },
      tone: {
        default: "text-foreground",
        muted: "text-muted-foreground",
        primary: "text-primary",
        secondary: "text-secondary",
        accent: "text-accent",
        success: "text-success",
        warning: "text-warning",
        info: "text-info",
        destructive: "text-destructive",
      },
      align: {
        left: "text-left",
        center: "text-center",
        right: "text-right",
      },
      weight: {
        regular: "font-semibold",
        bold: "font-bold",
      },
    },
    defaultVariants: {
      level: "h2",
      tone: "default",
      align: "left",
      weight: "regular",
    },
  }
);

const textVariants = cva(
  "antialiased",
  {
    variants: {
      variant: {
        body: "text-body",
        bodyLg: "text-body-lg",
        small: "text-body-sm",
        lead: "text-lead",
        caption: "text-caption",
        eyebrow: "text-eyebrow",
      },
      tone: {
        default: "text-foreground",
        muted: "text-muted-foreground",
        primary: "text-primary",
        secondary: "text-secondary",
        accent: "text-accent",
        success: "text-success",
        warning: "text-warning",
        info: "text-info",
        destructive: "text-destructive",
      },
      align: {
        left: "text-left",
        center: "text-center",
        right: "text-right",
        justify: "text-justify",
      },
      weight: {
        light: "font-light",
        normal: "font-normal",
        medium: "font-medium",
        semibold: "font-semibold",
      },
      uppercase: {
        true: "uppercase tracking-[0.12em]",
      },
    },
    defaultVariants: {
      variant: "body",
      tone: "default",
      align: "left",
      weight: "normal",
    },
  }
);

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof headingVariants> & {
    asChild?: boolean;
  };

const headingElementMap = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
} as const;

type HeadingLevel = keyof typeof headingElementMap;

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({
    className,
    level = "h2",
    tone,
    align,
    weight,
    asChild = false,
    ...props
  }, ref) => {
    const Component = asChild ? Slot : headingElementMap[level as HeadingLevel] ?? "h2";

    return (
      <Component
        ref={ref as React.Ref<HTMLHeadingElement>}
        className={cn(headingVariants({ level, tone, align, weight }), className)}
        {...props}
      />
    );
  }
);
Heading.displayName = "Heading";

type TextProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof textVariants> & {
    asChild?: boolean;
  };

const textDefaultElement: Record<NonNullable<TextProps["variant"]>, keyof HTMLElementTagNameMap> = {
  body: "p",
  bodyLg: "p",
  small: "p",
  lead: "p",
  caption: "span",
  eyebrow: "span",
};

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({
    className,
    variant = "body",
    tone,
    align,
    weight,
    uppercase,
    asChild = false,
    ...props
  }, ref) => {
    const resolvedVariant = variant ?? "body";
    const Component = (asChild
      ? Slot
      : textDefaultElement[resolvedVariant] ?? "p") as React.ElementType;

    return (
      <Component
        ref={ref as React.Ref<Element>}
        className={cn(textVariants({ variant: resolvedVariant, tone, align, weight, uppercase }), className)}
        {...props}
      />
    );
  }
);
Text.displayName = "Text";

export { Heading, Text, headingVariants, textVariants };
