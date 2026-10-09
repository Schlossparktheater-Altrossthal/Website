import { RouteLoading } from "@/components/route-loading";

// Sofortiges Feedback beim Seitenwechsel: Ohne Ladegrenze wartet die Navigation, bis
// die Zielseite komplett serverseitig gerendert ist, und Links können nicht vorab laden.
export default function LoadingMembersPage() {
  return <RouteLoading />;
}
