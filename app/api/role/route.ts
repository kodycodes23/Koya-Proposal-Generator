import { NextRequest, NextResponse } from "next/server";
import { ROLE_COOKIE, parseRole } from "@/lib/role";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const role = parseRole(body.role);
  if (!role) {
    return NextResponse.json({ error: "role must be \"salesperson\" or \"manager\"" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ROLE_COOKIE, role, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
