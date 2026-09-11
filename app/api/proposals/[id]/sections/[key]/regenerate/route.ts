import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";
import { regenerateSection } from "@/lib/anthropic";
import { SECTION_KEYS, type SectionKey, type ProposalIntake, type MissingField } from "@/lib/types";
import { flattenDeliverables, flattenPricing, flattenTimeline } from "@/lib/sections";

const BodySchema = z.object({ instruction: z.string().optional() });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  const { id, key } = await params;
  if (!SECTION_KEYS.includes(key as SectionKey)) {
    return NextResponse.json({ error: `Unknown section "${key}"` }, { status: 400 });
  }
  const sectionKey = key as SectionKey;
  const { instruction } = BodySchema.parse(await request.json().catch(() => ({})));

  const { data: proposal, error: proposalError } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (proposalError || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const { data: allSections, error: sectionsError } = await supabaseAdmin
    .from("proposal_sections")
    .select("*")
    .eq("proposal_id", id);

  if (sectionsError || !allSections) {
    return NextResponse.json({ error: sectionsError?.message }, { status: 500 });
  }

  const otherSections: Partial<Record<SectionKey, string>> = {};
  let currentVersion = 1;
  for (const row of allSections) {
    if (row.section_key === sectionKey) {
      currentVersion = row.version;
    } else {
      otherSections[row.section_key as SectionKey] = row.content;
    }
  }

  const intake: ProposalIntake = proposal;

  try {
    const result = await regenerateSection(intake, sectionKey, otherSections, instruction);

    const content =
      result.kind === "prose"
        ? result.content
        : result.kind === "deliverables"
          ? flattenDeliverables(result.structured)
          : result.kind === "timeline"
            ? flattenTimeline(result.structured)
            : flattenPricing(result.structured);
    const structured = result.kind === "prose" ? null : result.structured;

    const { error: updateError } = await supabaseAdmin
      .from("proposal_sections")
      .update({
        content,
        structured,
        source: "ai",
        version: currentVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("proposal_id", id)
      .eq("section_key", sectionKey);

    if (updateError) throw new Error(updateError.message);

    // Always reconcile missing_fields for this section - clear a stale flag
    // when the regeneration resolved it, or refresh the description if it's
    // still (or newly) missing. Never just append and forget.
    const currentMissing = (proposal.missing_fields || []) as MissingField[];
    const withoutThisSection = currentMissing.filter((m) => m.section !== sectionKey);
    const nextMissing = result.missingDescription
      ? [...withoutThisSection, { section: sectionKey, description: result.missingDescription }]
      : withoutThisSection;
    if (nextMissing.length !== currentMissing.length || result.missingDescription) {
      await supabaseAdmin.from("proposals").update({ missing_fields: nextMissing }).eq("id", id);
    }

    await logEvent(id, "section_regenerated", "success", { section_key: sectionKey, instruction });
    return NextResponse.json({ content, structured, missing: result.missingDescription != null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown regeneration error";
    await logEvent(id, "section_regenerated", "failure", { section_key: sectionKey, error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
