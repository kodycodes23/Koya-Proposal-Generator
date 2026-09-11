import { NextRequest, NextResponse } from "next/server";
import { ROLE_COOKIE, parseRole } from "@/lib/role";

// Server-side enforcement of the manager-only actions (approve, reject,
// send). The UI already hides these controls from a Sales Rep, but per
// Next's own guidance, a route handler must never rely on that (or on the
// proxy redirect) alone - this is the actual authorization check.
export function requireManager(request: NextRequest): NextResponse | null {
  const role = parseRole(request.cookies.get(ROLE_COOKIE)?.value);
  if (role !== "manager") {
    return NextResponse.json(
      { error: "Only a Manager can do this. Switch roles from the top nav if you need to act as one." },
      { status: 403 }
    );
  }
  return null;
}
