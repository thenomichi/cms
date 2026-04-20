import { getTeamMembers } from "@/lib/db/team";
import { TeamClient } from "./_components/TeamClient";

export default async function TeamPage() {
  const members = await getTeamMembers();
  return <TeamClient initialData={members} />;
}
