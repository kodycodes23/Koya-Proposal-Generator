import { supabaseAdmin } from "@/lib/supabase/server";

export async function logEvent(
  proposalId: string,
  eventType: string,
  status: "success" | "failure",
  detail: Record<string, unknown> = {}
) {
  const { error } = await supabaseAdmin.from("proposal_events").insert({
    proposal_id: proposalId,
    event_type: eventType,
    status,
    detail,
  });

  if (error) {
    // Logging itself failed. Don't throw and mask the original error/result -
    // surface this loudly server-side so it's visible in server logs even
    // though the UI won't see it via the events table.
    console.error(
      `[proposal_events] failed to log "${eventType}" for proposal ${proposalId}:`,
      error.message
    );
  }
}
