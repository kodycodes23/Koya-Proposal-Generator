import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROLE_COOKIE, parseRole } from "@/lib/role";

// Redirects to the role picker if no role is set yet. This is a lightweight
// device-level role selector, not authentication - there's no login, and the
// actual authorization check (manager-only approve/reject/send) happens
// server-side in those route handlers too, not just here. See the Proxy
// docs' own guidance: never rely on Proxy alone for authorization.
export function proxy(request: NextRequest) {
  const role = parseRole(request.cookies.get(ROLE_COOKIE)?.value);
  if (!role) {
    return NextResponse.redirect(new URL("/role", request.url));
  }
}

export const config = {
  matcher: ["/((?!api|role|_next/static|_next/image|icon.png|logo.png|favicon.ico).*)"],
};
