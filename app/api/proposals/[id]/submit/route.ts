import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: proposal } = await supabaseAdmin
    .from("proposals")
    .select("status")
    .eq("id", id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  // Draft is the normal path; sent/send_failed/rejected can also be
  // re-submitted after edits, so a revised proposal goes through internal
  // approval again before anything is re-sent to the client.
  const resubmittable = ["draft", "sent", "send_failed", "rejected"];
  if (!resubmittable.includes(proposal.status)) {
    return NextResponse.json(
      { error: `Cannot submit for approval from status "${proposal.status}"` },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("proposals")
    .update({ status: "pending_approval" })
    .eq("id", id);

  if (error) {
    await logEvent(id, "submitted_for_approval", "failure", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent(id, "submitted_for_approval", "success", {});
  return NextResponse.json({ ok: true });
}
