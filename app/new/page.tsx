"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const TEXT_FIELDS: { key: string; label: string; type?: string; required?: boolean }[] = [
  { key: "client_name", label: "Client Name", required: true },
  { key: "client_email", label: "Client Email", type: "email", required: true },
  { key: "company_name", label: "Company Name", required: true },
  { key: "date_of_call", label: "Date of Call", type: "date" },
  { key: "salesperson_name", label: "Salesperson Name", required: true },
];

const TEXTAREA_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "client_needs_summary", label: "Summary of Client's Needs", hint: "The problem the client wants to solve." },
  { key: "project_scope", label: "Project Scope", hint: "What the client wants built or delivered." },
  { key: "goals_and_objectives", label: "Goals and Objectives", hint: "Outcomes the client wants (revenue growth, efficiency, etc)." },
  { key: "recommended_services", label: "Recommended Services or Deliverables", hint: "Proposed services, outputs, or deliverables." },
  { key: "proposed_timeline", label: "Proposed Timeline", hint: "Expected duration, phases, or delivery window." },
  { key: "estimated_pricing", label: "Estimated Pricing", hint: "Proposed price, range, or pricing notes." },
];

const inputClass =
  "w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

export default function NewProposalPage() {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok && !data.id) {
        throw new Error(data.error || "Failed to create proposal");
      }
      if (!res.ok && data.id) {
        // Row was created but generation failed - still send them to the
        // workspace so they can see the failure and retry from there.
        router.push(`/proposals/${data.id}`);
        return;
      }
      router.push(`/proposals/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const allFields = [...TEXT_FIELDS, ...TEXTAREA_FIELDS];
  const filledCount = allFields.filter((f) => (form[f.key] || "").trim().length > 0).length;

  return (
    <main className="mx-auto max-w-3xl w-full px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Proposal</h1>
          <p className="text-sm text-gray-500 mt-1">
            Fill in what you know from the discovery call. Leave anything unclear blank — Claude will
            flag missing details instead of guessing.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm">
          {filledCount}/{allFields.length} filled
        </span>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Client &amp; Deal</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {TEXT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1.5">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type={f.type || "text"}
                  required={f.required}
                  value={form[f.key] || ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-black/[0.06] pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Proposal Content</h2>
          <div className="space-y-4">
            {TEXTAREA_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1">{f.label}</label>
                <p className="text-xs text-gray-400 mb-1.5">{f.hint}</p>
                <textarea
                  value={form[f.key] || ""}
                  onChange={(e) => update(f.key, e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-black/[0.06] pt-6">
          <label className="block text-sm font-medium mb-1">Supporting Material / Call Notes</label>
          <p className="text-xs text-gray-400 mb-1.5">
            Paste raw call notes, prior docs, or anything else the proposal should draw from.
          </p>
          <textarea
            value={form.supporting_material || ""}
            onChange={(e) => update("supporting_material", e.target.value)}
            rows={6}
            className={inputClass}
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-indigo-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Generating…" : "Generate Proposal"}
        </button>
      </form>
    </main>
  );
}
