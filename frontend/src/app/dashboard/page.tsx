import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Live overview of tobacco leaf scans, disease pressure, and grade distribution.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
