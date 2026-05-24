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
}

export const UI_PATTERNS = {
  confirmDialog: "confirm-dialog",
  asyncButton: "async-button",
  modalFormDialog: "modal-form-dialog",
} as const;
