/**
 * Icon-Komponenten für Sperrlistenübersicht
 * Basierend auf lucide-react mit einheitlichen Größen
 */

import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock,
  Star,
  Umbrella,
  XCircle,
} from "lucide-react";

// Standard Icon Props
type IconProps = {
  className?: string;
};

/**
 * Star Icon - Für bevorzugte Termine
 */
export function StarIcon({ className = "h-4 w-4" }: IconProps) {
  return <Star className={className} />;
}

/**
 * Clock Icon - Für "Heute" und aktuelle Zeit-Indikatoren
 */
export function ClockIcon({ className = "h-4 w-4" }: IconProps) {
  return <Clock className={className} />;
}

/**
 * Clock Alert Icon - Für eingeschränkte Verfügbarkeit
 */
export function ClockAlertIcon({ className = "h-4 w-4" }: IconProps) {
  return <AlertCircle className={className} />;
}

/**
 * XCircle Icon - Für gesperrte/blockierte Termine
 */
export function XCircleIcon({ className = "h-4 w-4" }: IconProps) {
  return <XCircle className={className} />;
}

/**
 * Check Icon - Für freie Verfügbarkeit
 */
export function CheckIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return <Check className={className} />;
}

/**
 * Umbrella Icon - Für Ferien/Urlaub
 */
export function UmbrellaIcon({ className = "h-4 w-4" }: IconProps) {
  return <Umbrella className={className} />;
}

/**
 * Calendar Star Icon - Für Feiertage
 */
export function CalendarStarIcon({ className = "h-4 w-4" }: IconProps) {
  return <CalendarDays className={className} />;
}
