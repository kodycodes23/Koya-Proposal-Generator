import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";

const DetailsSchema = z.object({
  client_name: z.string().min(1),
  client_email: z.string().email(),
  company_name: z.string().min(1),
  date_of_call: z.string().nullable().optional(),
  salesperson_name: z.string().min(1),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [{ data: proposal, error: proposalError }, { data: sections, error: sectionsError }, { data: events, error: eventsError }] =
    await Promise.all([
      supabaseAdmin.from("proposals").select("*").eq("id", id).single(),
      supabaseAdmin
        .from("proposal_sections")
        .select("*")
        .eq("proposal_id", id)
        .order("section_key"),
      supabaseAdmin
        .from("proposal_events")
        .select("*")
        .eq("proposal_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (proposalError || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  if (sectionsError || eventsError) {
    return NextResponse.json(
      { error: sectionsError?.message || eventsError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ proposal, sections, events });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = DetailsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Client Name, Client Email, Company Name, and Salesperson Name are required" },
      { status: 400 }
    );
  }
  const details = parsed.data;

  const { error } = await supabaseAdmin
    .from("proposals")
    .update({
      client_name: details.client_name,
      client_email: details.client_email,
      company_name: details.company_name,
      date_of_call: details.date_of_call || null,
      salesperson_name: details.salesperson_name,
    })
    .eq("id", id);

  if (error) {
    await logEvent(id, "details_updated", "failure", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent(id, "details_updated", "success", details);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: proposal } = await supabaseAdmin
    .from("proposals")
    .select("pdf_path")
    .eq("id", id)
    .single();

  // proposal_sections and proposal_events cascade-delete via their FK.
  const { error } = await supabaseAdmin.from("proposals").delete().eq("id", id);
  if (error) {
    await logEvent(id, "deleted", "failure", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (proposal?.pdf_path) {
    const { error: storageError } = await supabaseAdmin.storage.from("proposal-pdfs").remove([proposal.pdf_path]);
    if (storageError) {
      // The proposal row (and its events) are already gone at this point, so
      // there's nowhere left to log this against - surface it in server logs
      // instead, same as a logEvent write itself failing.
      console.error(`[delete] failed to remove stored PDF ${proposal.pdf_path}:`, storageError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
