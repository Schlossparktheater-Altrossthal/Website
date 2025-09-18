"use client";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVerticalIcon } from "./icons";

interface DropdownMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({ items, align = "right", className = "" }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemClick = (item: DropdownMenuItem) => {
    item.onClick();
    setIsOpen(false);
  };

  // Position menu via fixed portal to avoid clipping inside overflow containers
  useEffect(() => {
    if (!isOpen) return;
    const width = 192; // w-48
    const update = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const top = rect.bottom + 4; // small gap
      const left = align === "right" ? Math.max(8, rect.right - width) : rect.left;
      setCoords({ top, left });
    };
    update();
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("scroll", update, opts);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, opts);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, align]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md p-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Optionen"
      >
        <MoreVerticalIcon className="w-4 h-4" />
      </button>

      {isOpen && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              className={`fixed z-[1000] w-48 rounded-md border border-border bg-popover shadow-lg`}
              style={{ top: coords.top, left: coords.left }}
            >
              <div className="py-1">
                {items.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${
                      item.variant === "destructive"
                        ? "text-destructive hover:text-destructive"
                        : "text-foreground"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
