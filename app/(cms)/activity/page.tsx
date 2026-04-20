import { getActivityLog } from "@/lib/db/activity-log";
import { ActivityClient } from "./ActivityClient";

export default async function ActivityPage() {
  const logs = await getActivityLog(100);
  return <ActivityClient logs={logs} />;
}
