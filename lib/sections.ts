import { z } from "zod";
import type { DeliverablesData, PricingData, ProposalSection, TimelineData } from "@/lib/types";

export const DeliverableItemSchema = z.object({ title: z.string(), description: z.string() });
export const DeliverablesDataSchema = z.object({ items: z.array(DeliverableItemSchema) });

export const TimelinePhaseSchema = z.object({ name: z.string(), duration: z.string(), description: z.string() });
export const TimelineDataSchema = z.object({ phases: z.array(TimelinePhaseSchema) });

export const PricingLineItemSchema = z.object({
  label: z.string().max(40).describe('Short name for this line item, e.g. "Website Redesign" - not a sentence'),
  detail: z
    .string()
    .max(80)
    .describe('A few words of context, e.g. "One-time build cost" - never a paragraph or contract terms'),
  amount: z.number().nullable(),
});
export const PricingDataSchema = z.object({
  line_items: z.array(PricingLineItemSchema),
  total: z.number().nullable(),
  total_label: z
    .string()
    .max(50)
    .describe(
      'Just the figure, e.g. "$28,000" or "$25k-$35k depending on scope" - never a sentence or paragraph. Any explanation of terms, scope-change policy, or payment schedule belongs in the proposed_solution or next_steps prose sections, not here.'
    ),
});

export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function flattenDeliverables(data: DeliverablesData): string {
  return data.items.map((item) => `- ${item.title}: ${item.description}`).join("\n");
}

export function flattenTimeline(data: TimelineData): string {
  return data.phases.map((phase) => `${phase.name} (${phase.duration}): ${phase.description}`).join("\n\n");
}

export function flattenPricing(data: PricingData): string {
  const lines = data.line_items.map((li) =>
    li.amount != null ? `${li.label} — ${li.detail} — ${formatAmount(li.amount)}` : `${li.label} — ${li.detail}`
  );
  lines.push(`Total: ${data.total != null ? formatAmount(data.total) : data.total_label}`);
  return lines.join("\n");
}

export function pricingHasNumericBreakdown(data: PricingData): boolean {
  return data.line_items.length >= 2 && data.line_items.every((li) => li.amount != null);
}

// Extracts a week count from a duration label like "Weeks 1-2" (=2), "2 weeks"
// (=2), or "Week 3" (=1). Returns null when the phrasing doesn't parse - callers
// fall back to equal-width segments rather than asserting a proportion that
// isn't actually in the text.
export function parseWeeks(duration: string): number | null {
  const range = duration.match(/weeks?\s+(\d+)\s*-\s*(\d+)/i);
  if (range) return Number(range[2]) - Number(range[1]) + 1;
  const count = duration.match(/(\d+)\s*weeks?/i);
  if (count) return Number(count[1]);
  if (/^week\s+\d+$/i.test(duration.trim())) return 1;
  return null;
}

// Proportional widths (0-1) for a Gantt-style timeline bar. Real durations
// (parsed from what was actually written) when every phase parses; otherwise
// equal segments - never a fabricated proportion.
export function timelineSegmentWidths(data: TimelineData): number[] {
  const n = data.phases.length;
  if (n === 0) return [];
  const weeks = data.phases.map((p) => parseWeeks(p.duration));
  if (weeks.every((w): w is number => w != null)) {
    const total = weeks.reduce((sum, w) => sum + w, 0);
    if (total > 0) return weeks.map((w) => w / total);
  }
  return data.phases.map(() => 1 / n);
}

// Geometry for a donut chart built from stroke-dasharray + a per-slice
// rotation (react-pdf's SVG has no strokeDashoffset, so rotation is used
// instead - it produces an identical result and works in plain SVG too).
// `rotate` is a ready-to-use SVG transform angle (already includes the -90
// so the first slice starts at 12 o'clock). Shared by the PDF
// (react-pdf <Svg><Circle>) and the web preview (plain SVG) so both draw the
// exact same chart from the exact same numbers.
export function donutSlices(
  slices: { fraction: number }[],
  circumference: number
): { dasharray: string; rotate: number }[] {
  let offset = 0;
  return slices.map((s) => {
    const dash = s.fraction * circumference;
    const rotate = -90 + (offset / circumference) * 360;
    offset += dash;
    return { dasharray: `${dash} ${circumference - dash}`, rotate };
  });
}

// Shared "row -> renderable structured data" resolution, used by both the
// live in-app preview and the PDF so they can never drift out of sync for a
// given row. A row with structured = null (prose, or a pre-migration row)
// degrades to a single item/phase/line built from its plain-text content.
export function resolveDeliverables(row?: ProposalSection | null): DeliverablesData {
  if (row?.structured) return row.structured as DeliverablesData;
  return { items: row?.content ? [{ title: "Deliverables", description: row.content }] : [] };
}

export function resolveTimeline(row?: ProposalSection | null): TimelineData {
  if (row?.structured) return row.structured as TimelineData;
  return { phases: row?.content ? [{ name: "Engagement", duration: "", description: row.content }] : [] };
}

export function resolvePricing(row?: ProposalSection | null): PricingData {
  if (row?.structured) return row.structured as PricingData;
  return { line_items: [], total: null, total_label: row?.content || "" };
}
