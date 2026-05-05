import { getServiceClient } from "@/lib/supabase/server";
import { HeroImagesClient } from "./_components/HeroImagesClient";

export default async function HeroImagesPage() {
  const sb = getServiceClient();
  const { data } = await sb
    .from("page_hero_images")
    .select("*")
    .order("page_key");

  return <HeroImagesClient rows={data ?? []} />;
}
