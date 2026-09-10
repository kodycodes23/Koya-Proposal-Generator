import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";
import { generateProposal } from "@/lib/anthropic";
import { SECTION_KEYS } from "@/lib/types";
import { flattenDeliverables, flattenPricing, flattenTimeline } from "@/lib/sections";

const IntakeSchema = z.object({
  client_name: z.string().min(1),
  client_email: z.string().email(),
  company_name: z.string().min(1),
  date_of_call: z.string().nullable().optional(),
  salesperson_name: z.string().min(1),
  client_needs_summary: z.string().optional().default(""),
  project_scope: z.string().optional().default(""),
  goals_and_objectives: z.string().optional().default(""),
  recommended_services: z.string().optional().default(""),
  proposed_timeline: z.string().optional().default(""),
  estimated_pricing: z.string().optional().default(""),
  supporting_material: z.string().optional().nullable(),
});

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ proposals: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = IntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid intake data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const intake = parsed.data;

  const { data: proposal, error: insertError } = await supabaseAdmin
    .from("proposals")
    .insert({
      client_name: intake.client_name,
      client_email: intake.client_email,
      company_name: intake.company_name,
      date_of_call: intake.date_of_call || null,
      salesperson_name: intake.salesperson_name,
      client_needs_summary: intake.client_needs_summary,
      project_scope: intake.project_scope,
      goals_and_objectives: intake.goals_and_objectives,
      recommended_services: intake.recommended_services,
      proposed_timeline: intake.proposed_timeline,
      estimated_pricing: intake.estimated_pricing,
      supporting_material: intake.supporting_material || null,
      status: "draft",
    })
    .select()
    .single();

  if (insertError || !proposal) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to create proposal" },
      { status: 500 }
    );
  }

  await logEvent(proposal.id, "created", "success", { client_name: intake.client_name });

  try {
    const generated = await generateProposal({ ...intake, date_of_call: intake.date_of_call || null });

    const sectionRows = SECTION_KEYS.map((key) => {
      if (key === "deliverables") {
        return {
          proposal_id: proposal.id,
          section_key: key,
          content: flattenDeliverables(generated.deliverables),
          structured: generated.deliverables,
          source: "ai" as const,
          version: 1,
        };
      }
      if (key === "timeline") {
        return {
          proposal_id: proposal.id,
          section_key: key,
          content: flattenTimeline(generated.timeline),
          structured: generated.timeline,
          source: "ai" as const,
          version: 1,
        };
      }
      if (key === "pricing") {
        return {
          proposal_id: proposal.id,
          section_key: key,
          content: flattenPricing(generated.pricing),
          structured: generated.pricing,
          source: "ai" as const,
          version: 1,
        };
      }
      return {
        proposal_id: proposal.id,
        section_key: key,
        content: generated[key] as string,
        structured: null,
        source: "ai" as const,
        version: 1,
      };
    });

    const { error: sectionsError } = await supabaseAdmin
      .from("proposal_sections")
      .insert(sectionRows);

    if (sectionsError) throw new Error(sectionsError.message);

    const { error: updateError } = await supabaseAdmin
      .from("proposals")
      .update({ missing_fields: generated.missing_fields })
      .eq("id", proposal.id);

    if (updateError) throw new Error(updateError.message);

    await logEvent(proposal.id, "generated", "success", {
      missing_fields: generated.missing_fields,
    });

    return NextResponse.json({ id: proposal.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown generation error";
    await logEvent(proposal.id, "generated", "failure", { error: message });
    // The proposal row exists but has no sections yet - surface this clearly
    // rather than leaving the user on a blank/broken workspace silently.
    return NextResponse.json(
      { id: proposal.id, error: `Proposal created, but generation failed: ${message}` },
      { status: 502 }
    );
  }
}
