"use server";

import { cookies } from "next/headers";

export async function loginAction(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const validUser = process.env.CMS_ADMIN_USERNAME;
  const validPass = process.env.CMS_ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    return { success: false, error: "Admin credentials not configured" };
  }

  if (username !== validUser || password !== validPass) {
    return { success: false, error: "Invalid username or password" };
  }

  // Set a session cookie (httpOnly, 7 days)
  const cookieStore = await cookies();
  cookieStore.set("cms_session", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("cms_session");
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("cms_session")?.value === "authenticated";
}
