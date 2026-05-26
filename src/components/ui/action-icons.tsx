"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  BellRing,
  CalendarCheck,
  CalendarCog,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Hammer,
  Heart,
  Image as LucideImage,
  Info,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  MoreVertical,
  Pencil,
  PiggyBank,
  Plus,
  ShieldCheck,
  Sparkles,
  Theater,
  CirclePlus,
  Minus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Upload,
  User,
  UserRound,
  Users,
  UsersRound,
  Utensils,
  UtensilsCrossed,
  Wifi,
  WifiOff,
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

export function ChevronUpIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <ChevronUp className={className} aria-hidden {...props} />;
}

export function ArrowLeftIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <ArrowLeft className={className} aria-hidden {...props} />;
}

export function ArrowRightIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <ArrowRight className={className} aria-hidden {...props} />;
}

export function ArrowUpRightIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <ArrowUpRight className={className} aria-hidden {...props} />;
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

export function BellRingIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <BellRing className={className} aria-hidden {...props} />;
}

export function ClockIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Clock className={className} aria-hidden {...props} />;
}

export function MailIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Mail className={className} aria-hidden {...props} />;
}

export function MessageCircleIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <MessageCircle className={className} aria-hidden {...props} />;
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

export function CreditCardIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <CreditCard className={className} aria-hidden {...props} />;
}

export function UtensilsIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Utensils className={className} aria-hidden {...props} />;
}

export function HeartIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Heart className={className} aria-hidden {...props} />;
}

export function SparklesIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Sparkles className={className} aria-hidden {...props} />;
}

export function TheaterIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Theater className={className} aria-hidden {...props} />;
}

export function ShieldCheckIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <ShieldCheck className={className} aria-hidden {...props} />;
}

export function WifiIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Wifi className={className} aria-hidden {...props} />;
}

export function WifiOffIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <WifiOff className={className} aria-hidden {...props} />;
}

export function UserRoundIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <UserRound className={className} aria-hidden {...props} />;
}

export function CalendarCheckIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <CalendarCheck className={className} aria-hidden {...props} />;
}

export function CalendarCogIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <CalendarCog className={className} aria-hidden {...props} />;
}

export function UsersRoundIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <UsersRound className={className} aria-hidden {...props} />;
}

export function HammerIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <Hammer className={className} aria-hidden {...props} />;
}

export function PiggyBankIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <PiggyBank className={className} aria-hidden {...props} />;
}

export function CalendarRangeIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <CalendarRange className={className} aria-hidden {...props} />;
}

export function UtensilsCrossedIcon({ className = "w-4 h-4", ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return <UtensilsCrossed className={className} aria-hidden {...props} />;
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
