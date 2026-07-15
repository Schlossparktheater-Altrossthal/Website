import {
  AlertCircleIcon,
  CalendarDaysIcon,
  CheckIcon as BaseCheckIcon,
  ClockIcon as BaseClockIcon,
  StarIcon as BaseStarIcon,
  UmbrellaIcon as BaseUmbrellaIcon,
  XCircleIcon as BaseXCircleIcon,
} from "@/components/ui/action-icons";

// Standard Icon Props
type IconProps = {
  className?: string;
};

/**
 * Star Icon - Für bevorzugte Termine
 */
export function StarIcon({ className = "h-4 w-4" }: IconProps) {
  return <BaseStarIcon className={className} />;
}

/**
 * Clock Icon - Für "Heute" und aktuelle Zeit-Indikatoren
 */
export function ClockIcon({ className = "h-4 w-4" }: IconProps) {
  return <BaseClockIcon className={className} />;
}

/**
 * Clock Alert Icon - Für eingeschränkte Verfügbarkeit
 */
export function ClockAlertIcon({ className = "h-4 w-4" }: IconProps) {
  return <AlertCircleIcon className={className} />;
}

/**
 * XCircle Icon - Für gesperrte/blockierte Termine
 */
export function XCircleIcon({ className = "h-4 w-4" }: IconProps) {
  return <BaseXCircleIcon className={className} />;
}

/**
 * Check Icon - Für freie Verfügbarkeit
 */
export function CheckIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return <BaseCheckIcon className={className} />;
}

/**
 * Umbrella Icon - Für Ferien/Urlaub
 */
export function UmbrellaIcon({ className = "h-4 w-4" }: IconProps) {
  return <BaseUmbrellaIcon className={className} />;
}

/**
 * Calendar Star Icon - Für Feiertage
 */
export function CalendarStarIcon({ className = "h-4 w-4" }: IconProps) {
  return <CalendarDaysIcon className={className} />;
}
