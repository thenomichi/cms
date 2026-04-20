import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Exchange the code for a session
  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session?.user?.email) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Verify the user is an active team member
  const db = getServiceClient();
  const { data: member } = await db
    .from("team_members")
    .select("member_id")
    .eq("email", data.session.user.email)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) {
    // Not a team member — sign them out and redirect with error
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=unauthorized`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
