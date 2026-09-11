import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";

const BodySchema = z.object({
  client_name: z.string().min(1),
  client_email: z.string().email(),
  company_name: z.string().min(1),
  date_of_call: z.string().nullable().optional(),
  salesperson_name: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Client Name, Client Email, Company Name, and Salesperson Name are required" },
      { status: 400 }
    );
  }
  const identity = parsed.data;

  const [{ data: original, error: originalError }, { data: originalSections, error: sectionsError }] =
    await Promise.all([
      supabaseAdmin.from("proposals").select("*").eq("id", id).single(),
      supabaseAdmin.from("proposal_sections").select("*").eq("proposal_id", id),
    ]);

  if (originalError || !original) {
    return NextResponse.json({ error: "Original proposal not found" }, { status: 404 });
  }
  if (sectionsError || !originalSections) {
    return NextResponse.json({ error: sectionsError?.message }, { status: 500 });
  }

  const { data: copy, error: insertError } = await supabaseAdmin
    .from("proposals")
    .insert({
      client_name: identity.client_name,
      client_email: identity.client_email,
      company_name: identity.company_name,
      date_of_call: identity.date_of_call || null,
      salesperson_name: identity.salesperson_name,
      client_needs_summary: original.client_needs_summary,
      project_scope: original.project_scope,
      goals_and_objectives: original.goals_and_objectives,
      recommended_services: original.recommended_services,
      proposed_timeline: original.proposed_timeline,
      estimated_pricing: original.estimated_pricing,
      supporting_material: original.supporting_material,
      missing_fields: original.missing_fields,
      status: "draft",
    })
    .select()
    .single();

  if (insertError || !copy) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to create duplicate" },
      { status: 500 }
    );
  }

  if (originalSections.length > 0) {
    const { error: copySectionsError } = await supabaseAdmin.from("proposal_sections").insert(
      originalSections.map((s) => ({
        proposal_id: copy.id,
        section_key: s.section_key,
        content: s.content,
        structured: s.structured,
        source: s.source,
        version: 1,
      }))
    );
    if (copySectionsError) {
      // Don't leave a half-formed duplicate (a proposal row with no
      // sections) behind - roll it back and log the failure against the
      // proposal the user was actually acting on.
      await supabaseAdmin.from("proposals").delete().eq("id", copy.id);
      await logEvent(id, "duplicated", "failure", {
        error: copySectionsError.message,
        attempted_company_name: identity.company_name,
      });
      return NextResponse.json(
        { error: `Duplicate failed while copying sections: ${copySectionsError.message}` },
        { status: 500 }
      );
    }
  }

  await logEvent(id, "duplicated", "success", {
    new_proposal_id: copy.id,
    new_company_name: copy.company_name,
  });
  await logEvent(copy.id, "created", "success", {
    duplicated_from: id,
    duplicated_from_company: original.company_name,
  });

  return NextResponse.json({ id: copy.id }, { status: 201 });
}
