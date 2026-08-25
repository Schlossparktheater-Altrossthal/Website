import * as React from "react";

import { cn } from "@/lib/utils";

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="date"
        className={cn(
          "flex h-10 w-full min-w-0 appearance-none rounded-md border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm transition md:text-sm",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive/60 aria-invalid:ring-destructive/30",
          "[&::-webkit-date-and-time-value]:text-foreground [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:min-w-0 [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:text-foreground",
          "[&::-webkit-datetime-edit-fields-wrapper]:m-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:text-foreground",
          "[&::-webkit-datetime-edit-day-field]:p-0 [&::-webkit-datetime-edit-month-field]:p-0 [&::-webkit-datetime-edit-year-field]:p-0",
          "[&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100",
          className,
        )}
        {...props}
      />
    );
  },
);

DateInput.displayName = "DateInput";

export { DateInput };
