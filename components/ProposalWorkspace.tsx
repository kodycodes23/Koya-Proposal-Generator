"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { ProposalPreview } from "@/components/ProposalPreview";
import { ProposalActionsMenu } from "@/components/ProposalActionsMenu";
import { SECTION_LABELS } from "@/lib/types";
import type {
  Proposal,
  ProposalSection,
  ProposalEvent,
  SectionKey,
  DeliverableItem,
  TimelinePhase,
  PricingLineItem,
} from "@/lib/types";
import { resolveDeliverables, resolvePricing, resolveTimeline } from "@/lib/sections";
import { SECTION_ICONS } from "@/components/sectionIcons";

const INTAKE_DISPLAY_FIELDS: { key: keyof Proposal; label: string }[] = [
  { key: "client_email", label: "Client Email" },
  { key: "date_of_call", label: "Date of Call" },
  { key: "client_needs_summary", label: "Summary of Client's Needs" },
  { key: "project_scope", label: "Project Scope" },
  { key: "goals_and_objectives", label: "Goals and Objectives" },
  { key: "recommended_services", label: "Recommended Services or Deliverables" },
  { key: "proposed_timeline", label: "Proposed Timeline" },
  { key: "estimated_pricing", label: "Estimated Pricing" },
  { key: "supporting_material", label: "Supporting Material / Call Notes" },
];

const inputClass =
  "w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";
const card = "rounded-2xl border border-black/[0.06] bg-white shadow-sm";

async function fetchDetail(id: string) {
  const res = await fetch(`/api/proposals/${id}`);
  if (!res.ok) throw new Error("Failed to refresh proposal");
  return res.json() as Promise<{
    proposal: Proposal;
    sections: ProposalSection[];
    events: ProposalEvent[];
  }>;
}

function SectionShell({
  label,
  icon,
  meta,
  busy,
  error,
  instruction,
  onInstructionChange,
  onSave,
  onRegenerate,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  meta?: string;
  busy: "save" | "regenerate" | null;
  error: string | null;
  instruction: string;
  onInstructionChange: (v: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`${card} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 font-semibold text-sm">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-500">
            {icon}
          </span>
          {label}
        </h2>
        {meta && <span className="text-xs text-gray-400">{meta}</span>}
      </div>
      {children}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          onClick={onSave}
          disabled={!!busy}
          className="rounded-full border border-black/[0.08] px-3.5 py-1.5 text-xs font-medium hover:bg-black/[0.03] disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <input
          placeholder="Optional instruction for regeneration"
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          className="flex-1 min-w-[180px] rounded-full border border-black/[0.08] px-3 py-1.5 text-xs outline-none focus:border-gray-400"
        />
        <button
          onClick={onRegenerate}
          disabled={!!busy}
          className="rounded-full bg-gray-900 text-white px-3.5 py-1.5 text-xs font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {busy === "regenerate" ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
    </div>
  );
}

export function ProposalWorkspace({
  initialProposal,
  initialSections,
  initialEvents,
}: {
  initialProposal: Proposal;
  initialSections: ProposalSection[];
  initialEvents: ProposalEvent[];
}) {
  const [proposal, setProposal] = useState(initialProposal);
  const [sections, setSections] = useState(initialSections);
  const [events, setEvents] = useState(initialEvents);

  const byKey = Object.fromEntries(initialSections.map((s) => [s.section_key, s]));
  const [proseDrafts, setProseDrafts] = useState<Record<string, string>>(() => ({
    introduction: byKey.introduction?.content || "",
    proposed_solution: byKey.proposed_solution?.content || "",
    next_steps: byKey.next_steps?.content || "",
  }));
  const [deliverableItems, setDeliverableItems] = useState<DeliverableItem[]>(
    () => resolveDeliverables(byKey.deliverables).items
  );
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>(
    () => resolveTimeline(byKey.timeline).phases
  );
  const [pricingItems, setPricingItems] = useState<PricingLineItem[]>(
    () => resolvePricing(byKey.pricing).line_items
  );
  const [pricingTotalLabel, setPricingTotalLabel] = useState<string>(
    () => resolvePricing(byKey.pricing).total_label
  );

  const [instructionDrafts, setInstructionDrafts] = useState<Record<string, string>>({});
  const [sectionBusy, setSectionBusy] = useState<Record<string, "save" | "regenerate" | null>>({});
  const [sectionError, setSectionError] = useState<Record<string, string | null>>({});
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [approverName, setApproverName] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showIntake, setShowIntake] = useState(false);

  async function refresh() {
    const data = await fetchDetail(proposal.id);
    setProposal(data.proposal);
    setSections(data.sections);
    setEvents(data.events);
    const fresh = Object.fromEntries(data.sections.map((s) => [s.section_key, s]));
    setProseDrafts({
      introduction: fresh.introduction?.content || "",
      proposed_solution: fresh.proposed_solution?.content || "",
      next_steps: fresh.next_steps?.content || "",
    });
    setDeliverableItems(resolveDeliverables(fresh.deliverables).items);
    setTimelinePhases(resolveTimeline(fresh.timeline).phases);
    const freshPricing = resolvePricing(fresh.pricing);
    setPricingItems(freshPricing.line_items);
    setPricingTotalLabel(freshPricing.total_label);
  }

  async function saveSection(key: SectionKey, body: object) {
    setSectionBusy((b) => ({ ...b, [key]: "save" }));
    setSectionError((e) => ({ ...e, [key]: null }));
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/sections/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      await refresh();
    } catch (err) {
      setSectionError((e) => ({ ...e, [key]: err instanceof Error ? err.message : "Save failed" }));
    } finally {
      setSectionBusy((b) => ({ ...b, [key]: null }));
    }
  }

  async function regenerateSection(key: SectionKey) {
    setSectionBusy((b) => ({ ...b, [key]: "regenerate" }));
    setSectionError((e) => ({ ...e, [key]: null }));
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/sections/${key}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: instructionDrafts[key] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
      await refresh();
    } catch (err) {
      setSectionError((e) => ({ ...e, [key]: err instanceof Error ? err.message : "Regeneration failed" }));
    } finally {
      setSectionBusy((b) => ({ ...b, [key]: null }));
    }
  }

  async function doAction(path: string, body?: object) {
    setActionBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      if (data.warning) setActionNotice(data.warning);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(false);
    }
  }

  function pricingTotal(): number | null {
    if (pricingItems.length > 0 && pricingItems.every((li) => li.amount != null)) {
      return pricingItems.reduce((sum, li) => sum + (li.amount || 0), 0);
    }
    return null;
  }

  const rowFor = (key: SectionKey) => sections.find((s) => s.section_key === key);
  const meta = (key: SectionKey) => {
    const row = rowFor(key);
    return row ? `${row.source === "ai" ? "AI-generated" : "Edited"} · v${row.version}` : undefined;
  };
  const shellProps = (key: SectionKey) => ({
    busy: sectionBusy[key] || null,
    error: sectionError[key] || null,
    instruction: instructionDrafts[key] || "",
    onInstructionChange: (v: string) => setInstructionDrafts((d) => ({ ...d, [key]: v })),
    onRegenerate: () => regenerateSection(key),
  });

  return (
    <main className="mx-auto max-w-6xl w-full px-6 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
        ← All proposals
      </Link>

      <div className={`${card} p-5 mt-3 mb-6`}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {proposal.company_name} <span className="text-gray-400 font-normal">— {proposal.client_name}</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              {proposal.salesperson_name} · created {new Date(proposal.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={proposal.status} />
            <ProposalActionsMenu proposal={proposal} afterDelete="redirect-home" />
          </div>
        </div>

        <button
          onClick={() => setShowIntake((v) => !v)}
          className="mt-4 text-xs font-medium text-gray-500 hover:text-gray-900"
        >
          {showIntake ? "Hide intake details ▲" : "Show intake details ▼"}
        </button>
        {showIntake && (
          <dl className="mt-3 pt-4 border-t border-black/[0.06] space-y-3">
            {INTAKE_DISPLAY_FIELDS.map((f) => (
              <div key={String(f.key)}>
                <dt className="text-xs font-medium text-gray-400">{f.label}</dt>
                <dd className="text-sm whitespace-pre-wrap mt-0.5">{(proposal[f.key] as string) || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {proposal.missing_fields.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <p className="font-medium mb-1.5">Missing information flagged</p>
          <ul className="list-disc list-inside space-y-0.5">
            {proposal.missing_fields.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <SectionShell
            label={SECTION_LABELS.introduction}
            icon={SECTION_ICONS.introduction}
            meta={meta("introduction")}
            {...shellProps("introduction")}
            onSave={() => saveSection("introduction", { content: proseDrafts.introduction })}
          >
            <textarea
              value={proseDrafts.introduction}
              onChange={(e) => setProseDrafts((d) => ({ ...d, introduction: e.target.value }))}
              rows={5}
              className={inputClass}
            />
          </SectionShell>

          <SectionShell
            label={SECTION_LABELS.proposed_solution}
            icon={SECTION_ICONS.proposed_solution}
            meta={meta("proposed_solution")}
            {...shellProps("proposed_solution")}
            onSave={() => saveSection("proposed_solution", { content: proseDrafts.proposed_solution })}
          >
            <textarea
              value={proseDrafts.proposed_solution}
              onChange={(e) => setProseDrafts((d) => ({ ...d, proposed_solution: e.target.value }))}
              rows={5}
              className={inputClass}
            />
          </SectionShell>

          <SectionShell
            label={SECTION_LABELS.deliverables}
            icon={SECTION_ICONS.deliverables}
            meta={meta("deliverables")}
            {...shellProps("deliverables")}
            onSave={() => saveSection("deliverables", { structured: { items: deliverableItems } })}
          >
            <div className="space-y-2">
              {deliverableItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <input
                      placeholder="Title"
                      value={item.title}
                      onChange={(e) =>
                        setDeliverableItems((rows) =>
                          rows.map((r, ri) => (ri === i ? { ...r, title: e.target.value } : r))
                        )
                      }
                      className={inputClass}
                    />
                    <input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) =>
                        setDeliverableItems((rows) =>
                          rows.map((r, ri) => (ri === i ? { ...r, description: e.target.value } : r))
                        )
                      }
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={() => setDeliverableItems((rows) => rows.filter((_, ri) => ri !== i))}
                    className="text-gray-400 hover:text-red-600 text-xs px-1.5 py-1"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDeliverableItems((rows) => [...rows, { title: "", description: "" }])}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                + Add deliverable
              </button>
            </div>
          </SectionShell>

          <SectionShell
            label={SECTION_LABELS.timeline}
            icon={SECTION_ICONS.timeline}
            meta={meta("timeline")}
            {...shellProps("timeline")}
            onSave={() => saveSection("timeline", { structured: { phases: timelinePhases } })}
          >
            <div className="space-y-2">
              {timelinePhases.map((phase, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-1.5">
                    <input
                      placeholder="Phase name"
                      value={phase.name}
                      onChange={(e) =>
                        setTimelinePhases((rows) =>
                          rows.map((r, ri) => (ri === i ? { ...r, name: e.target.value } : r))
                        )
                      }
                      className={`col-span-1 ${inputClass}`}
                    />
                    <input
                      placeholder="Duration (e.g. Weeks 1-2)"
                      value={phase.duration}
                      onChange={(e) =>
                        setTimelinePhases((rows) =>
                          rows.map((r, ri) => (ri === i ? { ...r, duration: e.target.value } : r))
                        )
                      }
                      className={`col-span-1 ${inputClass}`}
                    />
                    <input
                      placeholder="Description"
                      value={phase.description}
                      onChange={(e) =>
                        setTimelinePhases((rows) =>
                          rows.map((r, ri) => (ri === i ? { ...r, description: e.target.value } : r))
                        )
                      }
                      className={`col-span-1 ${inputClass}`}
                    />
                  </div>
                  <button
                    onClick={() => setTimelinePhases((rows) => rows.filter((_, ri) => ri !== i))}
                    className="text-gray-400 hover:text-red-600 text-xs px-1.5 py-1"
                    aria-label="Remove phase"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setTimelinePhases((rows) => [...rows, { name: "", duration: "", description: "" }])}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                + Add phase
              </button>
            </div>
          </SectionShell>

          <SectionShell
            label={SECTION_LABELS.pricing}
            icon={SECTION_ICONS.pricing}
            meta={meta("pricing")}
            {...shellProps("pricing")}
            onSave={() =>
              saveSection("pricing", {
                structured: { line_items: pricingItems, total: pricingTotal(), total_label: pricingTotalLabel },
              })
            }
          >
            <div className="space-y-2">
              {pricingItems.map((li, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-1.5">
                    <input
                      placeholder="Label"
                      value={li.label}
                      onChange={(e) =>
                        setPricingItems((rows) => rows.map((r, ri) => (ri === i ? { ...r, label: e.target.value } : r)))
                      }
                      className={inputClass}
                    />
                    <input
                      placeholder="Detail"
                      value={li.detail}
                      onChange={(e) =>
                        setPricingItems((rows) => rows.map((r, ri) => (ri === i ? { ...r, detail: e.target.value } : r)))
                      }
                      className={inputClass}
                    />
                    <input
                      placeholder="Amount (optional)"
                      type="number"
                      value={li.amount ?? ""}
                      onChange={(e) =>
                        setPricingItems((rows) =>
                          rows.map((r, ri) =>
                            ri === i ? { ...r, amount: e.target.value === "" ? null : Number(e.target.value) } : r
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={() => setPricingItems((rows) => rows.filter((_, ri) => ri !== i))}
                    className="text-gray-400 hover:text-red-600 text-xs px-1.5 py-1"
                    aria-label="Remove line item"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setPricingItems((rows) => [...rows, { label: "", detail: "", amount: null }])}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                + Add line item
              </button>
              <div>
                <label className="block text-xs font-medium text-gray-500 mt-2 mb-1">
                  Total label (used when amounts aren&apos;t fully numeric, e.g. a range)
                </label>
                <input
                  value={pricingTotalLabel}
                  onChange={(e) => setPricingTotalLabel(e.target.value)}
                  maxLength={50}
                  placeholder='e.g. "$25k-$35k depending on scope"'
                  className={inputClass}
                />
              </div>
            </div>
          </SectionShell>

          <SectionShell
            label={SECTION_LABELS.next_steps}
            icon={SECTION_ICONS.next_steps}
            meta={meta("next_steps")}
            {...shellProps("next_steps")}
            onSave={() => saveSection("next_steps", { content: proseDrafts.next_steps })}
          >
            <textarea
              value={proseDrafts.next_steps}
              onChange={(e) => setProseDrafts((d) => ({ ...d, next_steps: e.target.value }))}
              rows={4}
              className={inputClass}
            />
          </SectionShell>

          <div className={`${card} p-5`}>
            {actionError && <p className="text-red-600 text-sm mb-3">{actionError}</p>}
            {actionNotice && <p className="text-amber-700 text-sm mb-3">{actionNotice}</p>}

            {proposal.status === "draft" && (
              <button
                onClick={() => doAction("submit")}
                disabled={actionBusy}
                className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Submit for Approval
              </button>
            )}

            {proposal.status === "pending_approval" && (
              <div className="space-y-3">
                <input
                  placeholder="Approver name"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className={`max-w-xs ${inputClass}`}
                />
                <div className="flex gap-2 items-center flex-wrap">
                  <button
                    onClick={() => approverName && doAction("approve", { approver_name: approverName })}
                    disabled={actionBusy || !approverName}
                    className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <input
                    placeholder="Rejection reason (optional)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    onClick={() =>
                      approverName && doAction("reject", { approver_name: approverName, reason: rejectReason })
                    }
                    disabled={actionBusy || !approverName}
                    className="rounded-full border border-red-200 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {(proposal.status === "approved" || proposal.status === "send_failed") && (
              <button
                onClick={() => doAction("send")}
                disabled={actionBusy}
                className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {proposal.status === "send_failed" ? "Retry Send to Client" : "Generate Final Document & Send to Client"}
              </button>
            )}

            {proposal.status === "sent" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Sent to {proposal.client_email} on{" "}
                  {proposal.sent_at && new Date(proposal.sent_at).toLocaleString()}.{" "}
                  {proposal.pdf_url && (
                    <a href={proposal.pdf_url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                      View final PDF
                    </a>
                  )}
                </p>
                <button
                  onClick={() => doAction("submit")}
                  disabled={actionBusy}
                  className="rounded-full border border-black/[0.08] px-4 py-2 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50"
                >
                  Made changes? Submit revision for approval
                </button>
              </div>
            )}

            {proposal.status === "rejected" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  This proposal was rejected internally. See activity log below.
                </p>
                <button
                  onClick={() => doAction("submit")}
                  disabled={actionBusy}
                  className="rounded-full border border-black/[0.08] px-4 py-2 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50"
                >
                  Resubmit for approval
                </button>
              </div>
            )}
          </div>

          <div className={`${card} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-black/[0.06]">
              <h2 className="font-semibold text-sm">Activity Log</h2>
            </div>
            <ul className="divide-y divide-black/[0.05]">
              {events.map((e) => (
                <li key={e.id} className={`px-5 py-3.5 ${e.status === "failure" ? "bg-red-50/60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${e.status === "failure" ? "text-red-700" : "text-gray-800"}`}>
                      {e.event_type.replaceAll("_", " ")} {e.status === "failure" && "— failed"}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  {Object.keys(e.detail || {}).length > 0 && (
                    <pre className="text-xs text-gray-500 mt-1.5 whitespace-pre-wrap break-words">
                      {JSON.stringify(e.detail, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
              {events.length === 0 && <li className="px-5 py-6 text-sm text-gray-400">No activity yet.</li>}
            </ul>
          </div>
        </div>

        <ProposalPreview proposal={proposal} sections={sections} />
      </div>
    </main>
  );
}
