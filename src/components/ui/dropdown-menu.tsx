"use client";

"use client";
import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { MoreVerticalIcon } from "./icons";

interface DropdownMenuItem {
  label: string;
  icon: React.ReactNode;
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

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 mt-1 w-48 rounded-md bg-popover border border-border shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
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
        </div>
      )}
    </div>
  );
}