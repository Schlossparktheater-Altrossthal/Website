import { redirect } from "next/navigation";

/** Probenplanung ist in der Terminplanung aufgegangen (Filter „Proben“). */
export default function RehearsalPlanningRedirect() {
  redirect("/mitglieder/terminplanung?art=proben");
}
