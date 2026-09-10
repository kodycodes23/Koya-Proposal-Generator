import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";
import {
  SECTION_KEYS,
  isStructuredSectionKey,
  type SectionKey,
  type DeliverablesData,
  type TimelineData,
  type PricingData,
} from "@/lib/types";
import {
  DeliverablesDataSchema,
  PricingDataSchema,
  TimelineDataSchema,
  flattenDeliverables,
  flattenPricing,
  flattenTimeline,
} from "@/lib/sections";

const BodySchema = z.union([
  z.object({ content: z.string() }),
  z.object({ structured: z.union([DeliverablesDataSchema, TimelineDataSchema, PricingDataSchema]) }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  const { id, key } = await params;
  if (!SECTION_KEYS.includes(key as (typeof SECTION_KEYS)[number])) {
    return NextResponse.json({ error: `Unknown section "${key}"` }, { status: 400 });
  }
  const sectionKey = key as SectionKey;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "content or structured is required" }, { status: 400 });
  }

  let content: string;
  let structured: unknown = null;

  if ("structured" in parsed.data) {
    if (!isStructuredSectionKey(sectionKey)) {
      return NextResponse.json(
        { error: `Section "${sectionKey}" does not take structured content` },
        { status: 400 }
      );
    }
    structured = parsed.data.structured;
    if (sectionKey === "deliverables") content = flattenDeliverables(parsed.data.structured as DeliverablesData);
    else if (sectionKey === "timeline") content = flattenTimeline(parsed.data.structured as TimelineData);
    else content = flattenPricing(parsed.data.structured as PricingData);
  } else {
    if (isStructuredSectionKey(sectionKey)) {
      return NextResponse.json(
        { error: `Section "${sectionKey}" requires structured content, not plain text` },
        { status: 400 }
      );
    }
    content = parsed.data.content;
  }

  const { data: existing } = await supabaseAdmin
    .from("proposal_sections")
    .select("version")
    .eq("proposal_id", id)
    .eq("section_key", key)
    .single();

  const { error } = await supabaseAdmin
    .from("proposal_sections")
    .update({
      content,
      structured,
      source: "human",
      version: (existing?.version || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("proposal_id", id)
    .eq("section_key", key);

  if (error) {
    await logEvent(id, "section_edited", "failure", { section_key: key, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent(id, "section_edited", "success", { section_key: key });
  return NextResponse.json({ ok: true });
}
