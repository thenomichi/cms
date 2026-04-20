import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const isPublicRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  const session = request.cookies.get("cms_session")?.value;
  const isAuthed = session === "authenticated";

  // Not logged in → redirect to login
  if (!isAuthed && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Already logged in → redirect away from login
  if (isAuthed && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
