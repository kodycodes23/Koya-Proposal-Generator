import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { DeliverablesData, PricingData, ProposalIntake, SectionKey, TimelineData } from "@/lib/types";
import { SECTION_KEYS, SECTION_LABELS, isStructuredSectionKey } from "@/lib/types";
import {
  DeliverableItemSchema,
  DeliverablesDataSchema,
  PricingDataSchema,
  PricingLineItemSchema,
  TimelineDataSchema,
  TimelinePhaseSchema,
} from "@/lib/sections";

const client = new Anthropic();

// Configurable so cost/quality can be tuned without a code change; defaults
// to Opus 5 for drafting quality.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const SYSTEM_PROMPT = `You are a senior proposal writer at Koya Talent, drafting client proposals for the sales team.

Ground rules:
- Write ONLY from the intake fields and supporting material given to you. Never invent client-specific facts: names, figures, dates, tools, or commitments that were not provided or clearly implied.
- A gap only exists when one of the 11 intake fields itself is blank, or so vague it gives you nothing to write from (e.g. "TBD", a single ambiguous word). In that case, insert the literal placeholder "[NEEDS INPUT: <what's missing>]" inline exactly where that detail belongs (in a prose field), or as the value itself (in a structured field), and record one entry per gap in missing_fields, naming the section it's in.
- Do NOT flag a gap for extra granularity an intake field doesn't need to include to be usable. Never invent a requirement (an exact date, a named sub-vendor, a percentage breakdown, a training/handover deliverable, etc.) that isn't implied by what the salesperson actually wrote, just to have something to flag or something to put in a table.
- Structured fields (deliverables, timeline, pricing) must be built ONLY from real distinctions the salesperson wrote. If Proposed Timeline is one lump duration with no phase breakdown, output exactly ONE phase, not an invented multi-phase plan. If Estimated Pricing has no real per-item breakdown, output ONE line item (or set amount to null and use total_label) rather than splitting a flat fee into invented line items.
- General best-practice language is fine when an approach isn't spelled out in detail (e.g. describing a sensible implementation process), but never fabricate specific numbers, dates, deliverable names, or pricing that were never given.
- If supporting material (call notes, prior docs, etc.) is provided, actively use concrete details from it in the relevant sections rather than writing generically.
- Write in a professional, client-ready tone. Prose fields are plain paragraphs (no markdown headings/lists) - the surrounding app renders headings and structured fields separately.`;

function formatIntake(input: ProposalIntake): string {
  const lines = [
    `Client Name: ${input.client_name}`,
    `Client Email: ${input.client_email}`,
    `Company Name: ${input.company_name}`,
    `Date of Call: ${input.date_of_call || "(not provided)"}`,
    `Salesperson Name: ${input.salesperson_name}`,
    `Summary of Client's Needs: ${input.client_needs_summary || "(not provided)"}`,
    `Project Scope: ${input.project_scope || "(not provided)"}`,
    `Goals and Objectives: ${input.goals_and_objectives || "(not provided)"}`,
    `Recommended Services or Deliverables: ${input.recommended_services || "(not provided)"}`,
    `Proposed Timeline: ${input.proposed_timeline || "(not provided)"}`,
    `Estimated Pricing: ${input.estimated_pricing || "(not provided)"}`,
  ];
  if (input.supporting_material?.trim()) {
    lines.push("", "Supporting Material / Call Notes:", input.supporting_material.trim());
  }
  return lines.join("\n");
}

const SECTION_GUIDE = `Sections to produce:
- introduction (prose): Thank the client for their time, restate their needs (client_needs_summary), and connect to their goals_and_objectives.
- proposed_solution (prose): Cover the project scope and a recommended approach (how Koya Talent will deliver it). Base the approach on recommended_services.
- deliverables (structured list): Break recommended_services into distinct deliverable items, each a short title + one-sentence description. Only split into multiple items if the input actually names multiple distinct things; otherwise one item.
- timeline (structured phases): Break proposed_timeline into phases actually described in the input (name + a duration label like "Weeks 1-2" + one-sentence description). One phase if the input doesn't describe multiple.
- pricing (structured line items + total): Reflect estimated_pricing. Use numeric "amount" only when a real number was given for that line; if only a total/range was given with no per-item split, use one line item and/or set amount to null and put the number or range in total_label. Every pricing field (label, detail, total_label) is short - a few words at most, never a sentence or paragraph. Do NOT put payment terms, scope-change policy, or any explanation into pricing fields - if that context is worth including, it belongs in proposed_solution or next_steps prose, not pricing.
- next_steps (prose): A short, warm closing paragraph about formalizing the engagement. Do NOT sign it or add a "Warm regards" / name / company line at the end - the app appends the signature block separately, right after this text.`;

// Stricter than the base PricingDataSchema (lib/sections.ts) - these length
// caps exist only to stop Claude from writing paragraph-length text into a
// field meant to hold a short figure. They apply to AI generation only; a
// human's own manual edit (validated against the base schema in the PATCH
// route) is never at risk of that failure mode and shouldn't be capped.
const AIPricingLineItemSchema = PricingLineItemSchema.extend({
  label: z.string().max(40).describe('Short name for this line item, e.g. "Website Redesign" - not a sentence'),
  detail: z
    .string()
    .max(80)
    .describe('A few words of context, e.g. "One-time build cost" - never a paragraph or contract terms'),
});
const AIPricingDataSchema = PricingDataSchema.extend({
  line_items: z.array(AIPricingLineItemSchema),
  total_label: z
    .string()
    .max(50)
    .describe(
      'Just the figure, e.g. "$28,000" or "$25k-$35k depending on scope" - never a sentence or paragraph. Any explanation of terms, scope-change policy, or payment schedule belongs in the proposed_solution or next_steps prose sections, not here.'
    ),
});

const ProposalSectionsSchema = z.object({
  introduction: z.string(),
  proposed_solution: z.string(),
  deliverables: DeliverablesDataSchema,
  timeline: TimelineDataSchema,
  pricing: AIPricingDataSchema,
  next_steps: z.string(),
  missing_fields: z
    .array(
      z.object({
        section: z.enum(SECTION_KEYS),
        description: z.string().describe('Short description of the gap, e.g. "No budget figure was given"'),
      })
    )
    .describe("One entry per gap that was flagged with a [NEEDS INPUT: ...] placeholder, naming its section"),
});

export type GeneratedProposal = z.infer<typeof ProposalSectionsSchema>;

export async function generateProposal(input: ProposalIntake): Promise<GeneratedProposal> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Draft a full client proposal from this intake data.\n\n${formatIntake(
          input
        )}\n\n${SECTION_GUIDE}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(ProposalSectionsSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parsable proposal content");
  }
  return response.parsed_output;
}

// Null when the gap is resolved, otherwise a short description - replaces a
// bare boolean so the caller can store *why* it's still missing, and so
// clearing a previously-flagged gap is an explicit, real value rather than a
// flag that only ever gets set and never cleared.
const missingDescriptionField = z
  .string()
  .nullable()
  .describe("Null if this section is now complete; otherwise a short description of what's still missing");

const ProseRegenSchema = z.object({
  content: z.string(),
  missing_description: missingDescriptionField,
});
const DeliverablesRegenSchema = z.object({
  items: z.array(DeliverableItemSchema),
  missing_description: missingDescriptionField,
});
const TimelineRegenSchema = z.object({
  phases: z.array(TimelinePhaseSchema),
  missing_description: missingDescriptionField,
});
const PricingRegenSchema = AIPricingDataSchema.extend({ missing_description: missingDescriptionField });

export type RegenResult =
  | { kind: "prose"; content: string; missingDescription: string | null }
  | { kind: "deliverables"; structured: DeliverablesData; missingDescription: string | null }
  | { kind: "timeline"; structured: TimelineData; missingDescription: string | null }
  | { kind: "pricing"; structured: PricingData; missingDescription: string | null };

export async function regenerateSection(
  input: ProposalIntake,
  sectionKey: SectionKey,
  otherSections: Partial<Record<SectionKey, string>>,
  instruction?: string
): Promise<RegenResult> {
  const context = Object.entries(otherSections)
    .filter(([, v]) => v)
    .map(([k, v]) => `${SECTION_LABELS[k as SectionKey]}:\n${v}`)
    .join("\n\n");

  const prompt = `Rewrite only the "${SECTION_LABELS[sectionKey]}" section of a client proposal, so it stays consistent with the rest of the proposal below.\n\nIntake data:\n${formatIntake(
    input
  )}\n\n${SECTION_GUIDE}\n\nCurrent other sections (for consistency, do not rewrite these):\n${context || "(none yet)"}\n\n${
    instruction ? `Additional instruction from the salesperson for this rewrite: ${instruction}` : ""
  }`;

  if (!isStructuredSectionKey(sectionKey)) {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(ProseRegenSchema) },
    });
    if (!response.parsed_output) throw new Error("Claude did not return parsable section content");
    const { missing_description, ...rest } = response.parsed_output;
    return { kind: "prose", missingDescription: missing_description, ...rest };
  }

  if (sectionKey === "deliverables") {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(DeliverablesRegenSchema) },
    });
    if (!response.parsed_output) throw new Error("Claude did not return parsable section content");
    const { missing_description, ...structured } = response.parsed_output;
    return { kind: "deliverables", structured, missingDescription: missing_description };
  }

  if (sectionKey === "timeline") {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(TimelineRegenSchema) },
    });
    if (!response.parsed_output) throw new Error("Claude did not return parsable section content");
    const { missing_description, ...structured } = response.parsed_output;
    return { kind: "timeline", structured, missingDescription: missing_description };
  }

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(PricingRegenSchema) },
  });
  if (!response.parsed_output) throw new Error("Claude did not return parsable section content");
  const { missing_description, ...structured } = response.parsed_output;
  return { kind: "pricing", structured, missingDescription: missing_description };
}

// --- Extracting intake fields from raw call notes (text, photos of
// handwritten notes, scans, PDFs) so a rep doesn't have to manually retype
// what's already sitting in their notes. ---

export type NoteImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export type NoteAttachment =
  | { kind: "image"; mediaType: NoteImageMediaType; base64: string; filename: string }
  | { kind: "pdf"; base64: string; filename: string }
  | { kind: "text"; text: string; filename: string };

const ExtractedIntakeSchema = z.object({
  client_name: z.string().nullable().describe("The client contact's name, or null if not mentioned"),
  client_email: z.string().nullable().describe("The client's email address, or null if not mentioned"),
  company_name: z.string().nullable(),
  date_of_call: z.string().nullable().describe("ISO date (YYYY-MM-DD) if a call/meeting date is stated, else null"),
  client_needs_summary: z.string().nullable().describe("The problem the client wants solved, in their words as summarized in the notes"),
  project_scope: z.string().nullable(),
  goals_and_objectives: z.string().nullable(),
  recommended_services: z.string().nullable(),
  proposed_timeline: z.string().nullable(),
  estimated_pricing: z.string().nullable(),
  transcription: z
    .string()
    .describe(
      "A clean, organized write-up of everything in the provided notes/images/documents - preserve every concrete " +
        "detail (names, numbers, dates, quotes) verbatim. This becomes the stored supporting material, so it must " +
        "be a faithful, complete transcription, not just a short summary."
    ),
});

export type ExtractedIntake = z.infer<typeof ExtractedIntakeSchema>;

const EXTRACT_SYSTEM_PROMPT = `You extract structured sales-call intake information from raw material a salesperson provides - typed notes, photos of handwritten notes, scanned documents, or PDFs. The material may be messy, informal, or partially illegible.

Ground rules:
- Extract ONLY what is explicitly stated or unambiguously implied by the material. Never guess, infer beyond what's written, or invent a plausible-sounding value for a field the notes don't actually cover.
- If a field genuinely isn't covered by the material, its value is null. A null is the correct, honest answer - not a failure.
- Do not merge or confuse different pieces of information (e.g. don't assume the person who wrote the notes is the client contact).
- The transcription field must capture everything in the material, not just what maps to the other fields - details that don't fit a specific field still belong in the transcription so nothing is lost.`;

function attachmentsToContent(attachments: NoteAttachment[]) {
  const blocks: Array<
    | { type: "image"; source: { type: "base64"; media_type: NoteImageMediaType; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
    | { type: "text"; text: string }
  > = [];

  for (const att of attachments) {
    if (att.kind === "image") {
      blocks.push({ type: "image", source: { type: "base64", media_type: att.mediaType, data: att.base64 } });
    } else if (att.kind === "pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: att.base64 } });
    } else {
      blocks.push({ type: "text", text: `Attached text file "${att.filename}":\n${att.text}` });
    }
  }
  return blocks;
}

// Anthropic API errors often carry their real message inside a raw JSON body
// (e.g. `err.message === '400 {"type":"error","error":{"message":"..."}}'`).
// Left as-is, that whole blob leaks straight to the UI. This pulls out just
// the human-readable inner message when there is one.
function cleanAnthropicError(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error";
  const raw = err.message;
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const inner = parsed?.error?.message || parsed?.message;
      if (typeof inner === "string") return inner;
    } catch {
      // Not JSON after all - fall through and use the raw message.
    }
  }
  return raw;
}

export async function extractIntakeFromNotes(
  attachments: NoteAttachment[],
  typedNotes?: string
): Promise<ExtractedIntake> {
  const content: Array<
    | { type: "image"; source: { type: "base64"; media_type: NoteImageMediaType; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
    | { type: "text"; text: string }
  > = [...attachmentsToContent(attachments)];

  const instruction = `Extract the intake fields and a full transcription from the material above.${
    typedNotes?.trim() ? `\n\nThe salesperson also typed this directly:\n${typedNotes.trim()}` : ""
  }`;
  content.push({ type: "text", text: instruction });

  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(ExtractedIntakeSchema) },
    });
  } catch (err) {
    throw new Error(cleanAnthropicError(err));
  }

  if (!response.parsed_output) {
    throw new Error("Claude did not return parsable extraction results");
  }
  return response.parsed_output;
}
