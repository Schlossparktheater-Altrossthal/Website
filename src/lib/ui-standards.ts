import type * as React from "react";
import type { ButtonProps } from "@/components/ui/button";

export interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: "destructive" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface AsyncButtonProps extends ButtonProps {
  isLoading: boolean;
  loadingText?: string;
}

export interface ModalFormDialogProps {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSave?: () => void;
  saveLabel?: string;
  /** Zusätzliche Klassen für die Dialogfläche (ab 640 px), z. B. eine breitere Variante. */
  contentClassName?: string;
}

export interface InlineScriptProps {
  /** Quelltext eines Inline-Skripts, das vor dem ersten Paint laufen soll. */
  html: string;
}

export interface SectionNavItem {
  /** Kennung der Ansicht; entspricht dem Wert in der URL (z. B. `?ansicht=`). */
  id: string;
  label: React.ReactNode;
  href: string;
}

export interface SectionNavProps {
  items: readonly SectionNavItem[];
  activeId: string;
  ariaLabel?: string;
  className?: string;
  /** "pills" (Standard) für Unterbereiche, "underline" für die Hauptbereiche einer Seite. */
  variant?: "pills" | "underline";
}

export const UI_PATTERNS = {
  confirmDialog: "confirm-dialog",
  asyncButton: "async-button",
  modalFormDialog: "modal-form-dialog",
  sectionNav: "section-nav",
  inlineScript: "inline-script",
} as const;
