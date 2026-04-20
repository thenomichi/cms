import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function getSession() {
  const supabase = await createServerAuthClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getTeamMember() {
  const session = await getSession();
  if (!session?.user?.email) return null;

  const { getServiceClient } = await import("./server");
  const db = getServiceClient();

  const { data } = await db
    .from("team_members")
    .select("*")
    .eq("email", session.user.email)
    .eq("is_active", true)
    .single();

  return data;
}
