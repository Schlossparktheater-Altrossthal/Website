"use client";

import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  idBase: string;
};

type TabsPillState = {
  left: number;
  width: number;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} muss innerhalb von <Tabs> verwendet werden.`);
  }
  return context;
}

function hasAnimatedChild(children: React.ReactNode): boolean {
  if (!isValidElement<{
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    transition?: unknown;
  }>(children)) {
    return false;
  }

  return (
    children.props.initial !== undefined &&
    children.props.animate !== undefined &&
    children.props.exit !== undefined &&
    children.props.transition !== undefined
  );
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
    if (controlledValue !== undefined || defaultValue === undefined) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      setUncontrolledValue(defaultValue);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
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
  const { value: activeValue } = useTabsContext("TabsList");
  const listRef = useRef<HTMLDivElement>(null);
  const [pillState, setPillState] = useState<TabsPillState>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const activeTrigger = listRef.current?.querySelector<HTMLButtonElement>(
      '[aria-selected="true"]',
    );

    if (!activeTrigger) {
      setPillState({ left: 0, width: 0 });
      return;
    }

    setPillState({
      left: activeTrigger.offsetLeft,
      width: activeTrigger.offsetWidth,
    });
  }, [activeValue]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "relative inline-flex flex-wrap items-center gap-2 overflow-hidden rounded-full",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-1 top-1 z-0 rounded-full border border-primary/60 bg-primary/15 transition-all duration-300 ease-in-out"
        style={{ left: pillState.left, width: pillState.width }}
      />
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
        "relative z-10 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition",
        isActive
          ? "border-transparent text-primary shadow-sm"
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
  const [fadeIn, setFadeIn] = useState(false);
  const isActive = activeValue === value;
  const shouldFade = !hasAnimatedChild(children);
  const panelId = `${idBase}-content-${value}`;
  const triggerId = `${idBase}-trigger-${value}`;

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setFadeIn(isActive);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isActive]);

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={triggerId}
      hidden={!isActive}
      className={cn(
        "focus-visible:outline-none",
        !isActive && "hidden",
        isActive && shouldFade && "transition-opacity duration-200",
        isActive && shouldFade && (fadeIn ? "opacity-100" : "opacity-0"),
        className,
      )}
    >
      {isActive ? children : null}
    </div>
  );
}
