"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  idBase: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} muss innerhalb von <Tabs> verwendet werden.`);
  }
  return context;
}

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState<string>(
    defaultValue ?? "",
  );
  const value = controlledValue ?? uncontrolledValue;

  useEffect(() => {
    if (controlledValue === undefined && defaultValue !== undefined) {
      setUncontrolledValue(defaultValue);
    }
  }, [controlledValue, defaultValue]);

  const setValue = useCallback(
    (next: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(next);
      }
      onValueChange?.(next);
    },
    [controlledValue, onValueChange],
  );

  const idBase = useId();

  const contextValue = useMemo<TabsContextValue>(
    () => ({ value, setValue, idBase }),
    [value, setValue, idBase],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

export function TabsList({ className, children }: TabsListProps) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-full bg-muted/40 p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const { value: activeValue, setValue, idBase } = useTabsContext("TabsTrigger");
  const isActive = activeValue === value;
  const triggerId = `${idBase}-trigger-${value}`;
  const panelId = `${idBase}-content-${value}`;

  return (
    <button
      type="button"
      role="tab"
      id={triggerId}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition",
        isActive
          ? "border-primary/60 bg-primary/15 text-primary shadow-sm"
          : "border-transparent bg-transparent text-muted-foreground hover:border-primary/20 hover:bg-primary/10 hover:text-foreground",
        className,
      )}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          setValue(value);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export function TabsContent({ value, className, children }: TabsContentProps) {
  const { value: activeValue, idBase } = useTabsContext("TabsContent");
  const isActive = activeValue === value;
  const panelId = `${idBase}-content-${value}`;
  const triggerId = `${idBase}-trigger-${value}`;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={triggerId}
      hidden={!isActive}
      className={cn("focus-visible:outline-none", !isActive && "hidden", className)}
    >
      {isActive ? children : null}
    </div>
  );
}
