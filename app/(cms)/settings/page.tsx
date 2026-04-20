import { getSiteSettings } from "@/lib/db/settings";
import { SettingsClient } from "./_components/SettingsClient";

export default async function SettingsPage() {
  const settings = await getSiteSettings();
  return <SettingsClient initialSettings={settings} />;
}
