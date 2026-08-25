"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownAZ,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowRightCircle,
  ArrowRightLeft,
  ArrowUpAZ,
  ArrowUpRight,
  AudioLines,
  BadgeCheck,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  BookOpenText,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarCog,
  CalendarDays,
  CalendarHeart,
  CalendarPlus,
  CalendarRange,
  Camera,
  Cat,
  Check,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Circle,
  CirclePlus,
  CircleX,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Drama,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  FileStack,
  FileText,
  Filter,
  FilterX,
  FolderOpen,
  GripVertical,
  Hammer,
  HardDrive,
  Heart,
  HeartHandshake,
  History,
  Image as LucideImage,
  Images,
  Info,
  Layers,
  LayoutGrid,
  List,
  ListChecks,
  ListTodo,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  MapPin,
  Maximize2,
  Megaphone,
  MessageCircle,
  Minus,
  MoonStar,
  MoreVertical,
  Music3,
  Package,
  PanelLeft,
  PawPrint,
  Pencil,
  PiggyBank,
  PlugZap,
  Plus,
  Power,
  Printer,
  Radio,
  RefreshCw,
  Ruler,
  Search,
  Settings,
  Settings2,
  Share2,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  Sun,
  Target,
  Theater,
  Timer,
  Trash2,
  Trees,
  Trophy,
  Umbrella,
  Undo2,
  Upload,
  User,
  UserCheck,
  UserRound,
  UserRoundCheck,
  UserX,
  Users,
  UsersRound,
  Utensils,
  UtensilsCrossed,
  WandSparkles,
  Wifi,
  WifiOff,
  Wrench,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import type * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: string | number;
  strokeWidth?: string | number;
  absoluteStrokeWidth?: boolean;
};

export type IconComponent = (props: IconProps) => React.ReactNode;

export const EditIcon = ({ className = "w-4 h-4", ...props }: IconProps) => {
  return <Pencil className={className} aria-hidden {...props} />;
};

export function TrashIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Trash2 className={className} aria-hidden {...props} />;
}

export function MoreVerticalIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <MoreVertical className={className} aria-hidden {...props} />;
}

export function PlusIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Plus className={className} aria-hidden {...props} />;
}

export function CloseIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <X className={className} aria-hidden {...props} />;
}

export function CheckIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Check className={className} aria-hidden {...props} />;
}

export function CopyIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Copy className={className} aria-hidden {...props} />;
}

export function DownloadIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Download className={className} aria-hidden {...props} />;
}

export function UploadIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Upload className={className} aria-hidden {...props} />;
}

export function SearchIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Search className={className} aria-hidden {...props} />;
}

export function FilterIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Filter className={className} aria-hidden {...props} />;
}

export function RefreshIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <RefreshCw className={className} aria-hidden {...props} />;
}

export function ChevronDownIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ChevronDown className={className} aria-hidden {...props} />;
}

export function ChevronRightIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ChevronRight className={className} aria-hidden {...props} />;
}

export function ChevronUpIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ChevronUp className={className} aria-hidden {...props} />;
}

export function ArrowLeftIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ArrowLeft className={className} aria-hidden {...props} />;
}

export function ArrowRightIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ArrowRight className={className} aria-hidden {...props} />;
}

export function ArrowUpRightIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ArrowUpRight className={className} aria-hidden {...props} />;
}

export function ExternalLinkIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ExternalLink className={className} aria-hidden {...props} />;
}

export function InfoIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Info className={className} aria-hidden {...props} />;
}

export function AlertIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <AlertTriangle className={className} aria-hidden {...props} />;
}

export function ErrorIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <AlertCircle className={className} aria-hidden {...props} />;
}

export function SuccessIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CheckCircle2 className={className} aria-hidden {...props} />;
}

export function LoadingIcon({
  className = "w-4 h-4 animate-spin",
  ...props
}: { className?: string } & IconProps) {
  return <Loader2 className={className} aria-hidden {...props} />;
}

export function LockIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Lock className={className} aria-hidden {...props} />;
}

export function EyeIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Eye className={className} aria-hidden {...props} />;
}

export function EyeOffIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <EyeOff className={className} aria-hidden {...props} />;
}

export function UserIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <User className={className} aria-hidden {...props} />;
}

export function UsersIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Users className={className} aria-hidden {...props} />;
}

export function CalendarIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Calendar className={className} aria-hidden {...props} />;
}

export function BellRingIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <BellRing className={className} aria-hidden {...props} />;
}

export function ClockIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Clock className={className} aria-hidden {...props} />;
}

export function MailIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Mail className={className} aria-hidden {...props} />;
}

export function MessageCircleIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <MessageCircle className={className} aria-hidden {...props} />;
}

export function FileIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <FileText className={className} aria-hidden {...props} />;
}

export function ImageIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <LucideImage className={className} aria-hidden {...props} />;
}

export function SettingsIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Settings className={className} aria-hidden {...props} />;
}

export function CreditCardIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CreditCard className={className} aria-hidden {...props} />;
}

export function UtensilsIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Utensils className={className} aria-hidden {...props} />;
}

export function HeartIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Heart className={className} aria-hidden {...props} />;
}

export function SparklesIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Sparkles className={className} aria-hidden {...props} />;
}

export function TheaterIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Theater className={className} aria-hidden {...props} />;
}

export function ShieldCheckIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ShieldCheck className={className} aria-hidden {...props} />;
}

export function WifiIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Wifi className={className} aria-hidden {...props} />;
}

export function WifiOffIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <WifiOff className={className} aria-hidden {...props} />;
}

export function UserRoundIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <UserRound className={className} aria-hidden {...props} />;
}

export function GripVerticalIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <GripVertical className={className} aria-hidden {...props} />;
}
export function CalendarCheckIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CalendarCheck className={className} aria-hidden {...props} />;
}

export function CalendarCogIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CalendarCog className={className} aria-hidden {...props} />;
}

export function CatIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Cat className={className} aria-hidden {...props} />;
}

export function BookOpenTextIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <BookOpenText className={className} aria-hidden {...props} />;
}

export function UsersRoundIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <UsersRound className={className} aria-hidden {...props} />;
}

export function HammerIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Hammer className={className} aria-hidden {...props} />;
}

export function PiggyBankIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <PiggyBank className={className} aria-hidden {...props} />;
}

export function CalendarRangeIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CalendarRange className={className} aria-hidden {...props} />;
}

export function UtensilsCrossedIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <UtensilsCrossed className={className} aria-hidden {...props} />;
}

export function CirclePlusIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CirclePlus className={className} aria-hidden {...props} />;
}

export function MinusIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Minus className={className} aria-hidden {...props} />;
}

export function PrinterIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Printer className={className} aria-hidden {...props} />;
}

export function ActivityIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Activity className={className} aria-hidden {...props} />;
}

export function AlertCircleIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <AlertCircle className={className} aria-hidden {...props} />;
}

export function AlertTriangleIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <AlertTriangle className={className} aria-hidden {...props} />;
}

export function ArrowDownAZIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ArrowDownAZ className={className} aria-hidden {...props} />;
}

export function ArrowLeftRightIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ArrowLeftRight className={className} aria-hidden {...props} />;
}

export function ArrowRightCircleIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ArrowRightCircle className={className} aria-hidden {...props} />;
}

export function ArrowRightLeftIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ArrowRightLeft className={className} aria-hidden {...props} />;
}

export function ArrowUpAZIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ArrowUpAZ className={className} aria-hidden {...props} />;
}

export function AudioLinesIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <AudioLines className={className} aria-hidden {...props} />;
}

export function BadgeCheckIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <BadgeCheck className={className} aria-hidden {...props} />;
}

export function BarChart3Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <BarChart3 className={className} aria-hidden {...props} />;
}

export function BellIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Bell className={className} aria-hidden {...props} />;
}

export function BookOpenIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <BookOpen className={className} aria-hidden {...props} />;
}

export function Building2Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Building2 className={className} aria-hidden {...props} />;
}

export function CalendarClockIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CalendarClock className={className} aria-hidden {...props} />;
}

export function CalendarDaysIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CalendarDays className={className} aria-hidden {...props} />;
}

export function CalendarHeartIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CalendarHeart className={className} aria-hidden {...props} />;
}

export function CalendarPlusIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CalendarPlus className={className} aria-hidden {...props} />;
}

export function CameraIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Camera className={className} aria-hidden {...props} />;
}

export function CheckCircleIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CheckCircle className={className} aria-hidden {...props} />;
}

export function CheckCircle2Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CheckCircle2 className={className} aria-hidden {...props} />;
}

export function CheckSquareIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CheckSquare className={className} aria-hidden {...props} />;
}

export function ChevronLeftIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ChevronLeft className={className} aria-hidden {...props} />;
}

export function ChevronsUpDownIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ChevronsUpDown className={className} aria-hidden {...props} />;
}

export function CircleIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Circle className={className} aria-hidden {...props} />;
}

export function CircleXIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <CircleX className={className} aria-hidden {...props} />;
}

export function ClapperboardIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Clapperboard className={className} aria-hidden {...props} />;
}

export function ClipboardCheckIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ClipboardCheck className={className} aria-hidden {...props} />;
}

export function ClipboardListIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ClipboardList className={className} aria-hidden {...props} />;
}

export function Clock3Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Clock3 className={className} aria-hidden {...props} />;
}

export function DramaIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Drama className={className} aria-hidden {...props} />;
}

export function FileDownIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <FileDown className={className} aria-hidden {...props} />;
}

export function FileStackIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <FileStack className={className} aria-hidden {...props} />;
}

export function FilterXIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <FilterX className={className} aria-hidden {...props} />;
}

export function FolderOpenIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <FolderOpen className={className} aria-hidden {...props} />;
}

export function HardDriveIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <HardDrive className={className} aria-hidden {...props} />;
}

export function HeartHandshakeIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <HeartHandshake className={className} aria-hidden {...props} />;
}

export function HistoryIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <History className={className} aria-hidden {...props} />;
}

export function ImagesIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Images className={className} aria-hidden {...props} />;
}

export function LayersIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Layers className={className} aria-hidden {...props} />;
}

export function LayoutGridIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <LayoutGrid className={className} aria-hidden {...props} />;
}

export function ListIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <List className={className} aria-hidden {...props} />;
}

export function ListChecksIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ListChecks className={className} aria-hidden {...props} />;
}

export function ListTodoIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <ListTodo className={className} aria-hidden {...props} />;
}

export function Loader2Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Loader2 className={className} aria-hidden {...props} />;
}

export function MailCheckIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <MailCheck className={className} aria-hidden {...props} />;
}

export function MapPinIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <MapPin className={className} aria-hidden {...props} />;
}

export function Maximize2Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Maximize2 className={className} aria-hidden {...props} />;
}

export function MegaphoneIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Megaphone className={className} aria-hidden {...props} />;
}

export function MoonStarIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <MoonStar className={className} aria-hidden {...props} />;
}

export function Music3Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Music3 className={className} aria-hidden {...props} />;
}

export function PackageIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Package className={className} aria-hidden {...props} />;
}

export function PanelLeftIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <PanelLeft className={className} aria-hidden {...props} />;
}

export function PawPrintIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <PawPrint className={className} aria-hidden {...props} />;
}

export function PencilIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Pencil className={className} aria-hidden {...props} />;
}

export function PlugZapIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <PlugZap className={className} aria-hidden {...props} />;
}

export function PowerIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Power className={className} aria-hidden {...props} />;
}

export function RadioIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Radio className={className} aria-hidden {...props} />;
}

export function RefreshCwIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <RefreshCw className={className} aria-hidden {...props} />;
}

export function RulerIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Ruler className={className} aria-hidden {...props} />;
}

export function Settings2Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Settings2 className={className} aria-hidden {...props} />;
}

export function Share2Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Share2 className={className} aria-hidden {...props} />;
}

export function ShirtIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Shirt className={className} aria-hidden {...props} />;
}

export function StarIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Star className={className} aria-hidden {...props} />;
}

export function SunIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Sun className={className} aria-hidden {...props} />;
}

export function TargetIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Target className={className} aria-hidden {...props} />;
}

export function TimerIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Timer className={className} aria-hidden {...props} />;
}

export function Trash2Icon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Trash2 className={className} aria-hidden {...props} />;
}

export function TreesIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Trees className={className} aria-hidden {...props} />;
}

export function TrophyIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Trophy className={className} aria-hidden {...props} />;
}

export function UmbrellaIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Umbrella className={className} aria-hidden {...props} />;
}

export function Undo2Icon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Undo2 className={className} aria-hidden {...props} />;
}

export function UserCheckIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <UserCheck className={className} aria-hidden {...props} />;
}

export function UserRoundCheckIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <UserRoundCheck className={className} aria-hidden {...props} />;
}

export function UserXIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <UserX className={className} aria-hidden {...props} />;
}

export function WandSparklesIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <WandSparkles className={className} aria-hidden {...props} />;
}

export function WrenchIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <Wrench className={className} aria-hidden {...props} />;
}

export function XIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <X className={className} aria-hidden {...props} />;
}

export function XCircleIcon({
  className = "w-4 h-4",
  ...props
}: { className?: string } & IconProps) {
  return <XCircle className={className} aria-hidden {...props} />;
}

export function ZapIcon({ className = "w-4 h-4", ...props }: { className?: string } & IconProps) {
  return <Zap className={className} aria-hidden {...props} />;
}
