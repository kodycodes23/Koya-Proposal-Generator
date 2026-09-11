import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";
import { requireManager } from "@/lib/authz";

const BodySchema = z.object({ approver_name: z.string().min(1) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleError = requireManager(request);
  if (roleError) return roleError;

  const { id } = await params;
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "approver_name is required" }, { status: 400 });
  }

  const { data: proposal } = await supabaseAdmin
    .from("proposals")
    .select("status")
    .eq("id", id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  if (proposal.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot approve from status "${proposal.status}"` },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("proposals")
    .update({
      status: "approved",
      approved_by: parsed.data.approver_name,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    await logEvent(id, "approved", "failure", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent(id, "approved", "success", { approver_name: parsed.data.approver_name });
  return NextResponse.json({ ok: true });
}
