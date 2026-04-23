export async function revalidateWebsite(paths: string[], tags: string[] = []): Promise<void> {
  const websiteUrl = process.env.WEBSITE_URL;
  const secret = process.env.REVALIDATION_SECRET;
  if (!websiteUrl || !secret) return; // silently skip if not configured

  try {
    await fetch(`${websiteUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, paths, tags }),
    });
  } catch {
    // Fire-and-forget: website eventually refreshes via ISR anyway
    console.warn("[CMS] Revalidation request failed for paths:", paths);
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export const revalidateTrip = (slug: string) =>
  revalidateWebsite([
    "/",
    "/join-a-trip",
    "/beyond-ordinary",
    "/signature-journeys",
    `/trips/${slug}`,
  ]);

export const revalidateReview = (tripSlug?: string) =>
  revalidateWebsite(tripSlug ? ["/", `/trips/${tripSlug}`] : ["/"]);

export const revalidateHome = () => revalidateWebsite(["/"]);

export const revalidateAbout = () => revalidateWebsite(["/about"]);

export const revalidateCareers = () => revalidateWebsite(["/careers"]);
