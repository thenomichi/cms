import { listDepartureCities } from "@/lib/db/departure-cities";
import { listExclusions } from "@/lib/db/exclusions";
import { listInclusionChips } from "@/lib/db/inclusion-chips";
import { findResumableDraft, CMS_SHARED_OWNER_ID } from "@/lib/db/trips";
import { getServiceClient } from "@/lib/supabase/server";
import type { DbDestination } from "@/lib/types";
import { NewTripWrapper } from "./NewTripWrapper";

// Auth is enforced upstream by app/(cms)/layout.tsx (cms_session cookie).
// The CMS doesn't have per-user identity today — autosave drafts are
// scoped to a shared owner constant so all admins see the same drafts.

export default async function NewTripPage() {
  const sb = getServiceClient();
  const [destRes, departureCities, exclusions, inclusionChips, resumable] = await Promise.all([
    sb
      .from("destinations")
      .select("*")
      .eq("is_active", true)
      .order("destination_name"),
    listDepartureCities(),
    listExclusions(),
    listInclusionChips(),
    findResumableDraft(CMS_SHARED_OWNER_ID),
  ]);

  return (
    <NewTripWrapper
      userId={CMS_SHARED_OWNER_ID}
      destinations={(destRes.data ?? []) as DbDestination[]}
      departureCities={departureCities}
      exclusions={exclusions}
      inclusionChips={inclusionChips}
      websiteUrl={process.env.WEBSITE_URL ?? "http://localhost:3000"}
      resumable={resumable}
    />
  );
}
