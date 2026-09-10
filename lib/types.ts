export type ProposalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "sent"
  | "send_failed";

export const SECTION_KEYS = [
  "introduction",
  "proposed_solution",
  "deliverables",
  "timeline",
  "pricing",
  "next_steps",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  introduction: "1. Introduction",
  proposed_solution: "2. Proposed Solution",
  deliverables: "3. Deliverables",
  timeline: "4. Timeline",
  pricing: "5. Pricing",
  next_steps: "6. Next Steps",
};

export interface ProposalIntake {
  client_name: string;
  client_email: string;
  company_name: string;
  date_of_call: string | null;
  salesperson_name: string;
  client_needs_summary: string;
  project_scope: string;
  goals_and_objectives: string;
  recommended_services: string;
  proposed_timeline: string;
  estimated_pricing: string;
  supporting_material?: string | null;
}

export interface Proposal extends ProposalIntake {
  id: string;
  status: ProposalStatus;
  missing_fields: string[];
  approved_by: string | null;
  approved_at: string | null;
  pdf_path: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export const STRUCTURED_SECTION_KEYS = ["deliverables", "timeline", "pricing"] as const;
export type StructuredSectionKey = (typeof STRUCTURED_SECTION_KEYS)[number];

export function isStructuredSectionKey(key: SectionKey): key is StructuredSectionKey {
  return (STRUCTURED_SECTION_KEYS as readonly string[]).includes(key);
}

export interface DeliverableItem {
  title: string;
  description: string;
}
export interface DeliverablesData {
  items: DeliverableItem[];
}

export interface TimelinePhase {
  name: string;
  duration: string;
  description: string;
}
export interface TimelineData {
  phases: TimelinePhase[];
}

export interface PricingLineItem {
  label: string;
  detail: string;
  amount: number | null;
}
export interface PricingData {
  line_items: PricingLineItem[];
  total: number | null;
  total_label: string;
}

export type StructuredFor<K extends StructuredSectionKey> = K extends "deliverables"
  ? DeliverablesData
  : K extends "timeline"
    ? TimelineData
    : PricingData;

export interface ProposalSection {
  id: string;
  proposal_id: string;
  section_key: SectionKey;
  content: string;
  // Populated only for STRUCTURED_SECTION_KEYS rows generated/edited after
  // this column was added; null (including for prose sections) means
  // "render `content` as prose".
  structured: DeliverablesData | TimelineData | PricingData | null;
  source: "ai" | "human";
  version: number;
  updated_at: string;
}

export interface ProposalEvent {
  id: string;
  proposal_id: string;
  event_type: string;
  status: "success" | "failure";
  detail: Record<string, unknown>;
  created_at: string;
}
