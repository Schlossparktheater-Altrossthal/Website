"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Image as LucideImage,
  Info,
  Loader2,
  Lock,
  Mail,
  MoreVertical,
  Pencil,
  Plus,
  CirclePlus,
  Minus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Upload,
  User,
  Users,
  X,
  CalendarDays,
} from "lucide-react";
import type * as React from "react";

export const EditIcon = ({ className = "w-4 h-4", ...props }: React.SVGProps<SVGSVGElement>) => {
  return <Pencil className={className} aria-hidden {...props} />;
};

export function TrashIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Trash2 className={className} aria-hidden {...props} />;
}

export function MoreVerticalIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <MoreVertical className={className} aria-hidden {...props} />;
}

export function PlusIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Plus className={className} aria-hidden {...props} />;
}

export function CloseIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <X className={className} aria-hidden {...props} />;
}

export function CheckIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Check className={className} aria-hidden {...props} />;
}

export function CopyIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Copy className={className} aria-hidden {...props} />;
}

export function DownloadIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Download className={className} aria-hidden {...props} />;
}

export function UploadIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Upload className={className} aria-hidden {...props} />;
}

export function SearchIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Search className={className} aria-hidden {...props} />;
}

export function FilterIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Filter className={className} aria-hidden {...props} />;
}

export function RefreshIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <RefreshCw className={className} aria-hidden {...props} />;
}

export function ChevronDownIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <ChevronDown className={className} aria-hidden {...props} />;
}

export function ChevronRightIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <ChevronRight className={className} aria-hidden {...props} />;
}

export function ArrowLeftIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <ArrowLeft className={className} aria-hidden {...props} />;
}

export function ExternalLinkIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <ExternalLink className={className} aria-hidden {...props} />;
}

export function InfoIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Info className={className} aria-hidden {...props} />;
}

export function AlertIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <AlertTriangle className={className} aria-hidden {...props} />;
}

export function ErrorIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <AlertCircle className={className} aria-hidden {...props} />;
}

export function SuccessIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <CheckCircle2 className={className} aria-hidden {...props} />;
}

export function LoadingIcon({ className = "w-4 h-4 animate-spin", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Loader2 className={className} aria-hidden {...props} />;
}

export function LockIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Lock className={className} aria-hidden {...props} />;
}

export function EyeIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Eye className={className} aria-hidden {...props} />;
}

export function EyeOffIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <EyeOff className={className} aria-hidden {...props} />;
}

export function UserIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <User className={className} aria-hidden {...props} />;
}

export function UsersIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Users className={className} aria-hidden {...props} />;
}

export function CalendarIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <CalendarDays className={className} aria-hidden {...props} />;
}

export function ClockIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Clock className={className} aria-hidden {...props} />;
}

export function MailIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Mail className={className} aria-hidden {...props} />;
}

export function FileIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <FileText className={className} aria-hidden {...props} />;
}

export function ImageIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <LucideImage className={className} aria-hidden {...props} />;
}

export function SettingsIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Settings className={className} aria-hidden {...props} />;
}


export function CirclePlusIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <CirclePlus className={className} aria-hidden {...props} />;
}

export function MinusIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Minus className={className} aria-hidden {...props} />;
}

export function PrinterIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Printer className={className} aria-hidden {...props} />;
}
