import { getDashboardStats } from "@/lib/db/dashboard";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  return <DashboardClient stats={stats} />;
}
