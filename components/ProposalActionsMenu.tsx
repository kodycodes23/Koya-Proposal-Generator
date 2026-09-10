"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KebabIcon, CopyIcon, TrashIcon } from "@/components/icons";

const inputClass =
  "w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

export interface DuplicateSource {
  id: string;
  client_name: string;
  client_email: string;
  company_name: string;
  date_of_call: string | null;
  salesperson_name: string;
}

export function ProposalActionsMenu({
  proposal,
  afterDelete = "refresh",
}: {
  proposal: DuplicateSource;
  /** "refresh" re-fetches the current route (dashboard list); "redirect-home"
   * navigates to "/" instead (used from a proposal's own workspace page,
   * which can't just refresh itself after its data is gone). Plain string so
   * this stays usable from a Server Component parent - a function prop can't
   * cross that boundary. */
  afterDelete?: "refresh" | "redirect-home";
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    client_name: proposal.client_name,
    client_email: proposal.client_email,
    company_name: proposal.company_name,
    date_of_call: proposal.date_of_call || "",
    salesperson_name: proposal.salesperson_name,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleDuplicate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to duplicate proposal");
      router.push(`/proposals/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate proposal");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the proposal for ${proposal.company_name}? This can't be undone.`)) return;
    setMenuOpen(false);
    const res = await fetch(`/api/proposals/${proposal.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || "Failed to delete proposal");
      return;
    }
    if (afterDelete === "redirect-home") router.push("/");
    else router.refresh();
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-black/[0.04] hover:text-gray-700"
        aria-label="Proposal actions"
      >
        <KebabIcon className="w-4 h-4" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-black/[0.08] bg-white py-1 shadow-lg">
            <button
              onClick={() => {
                setMenuOpen(false);
                setModalOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-gray-700 hover:bg-black/[0.03]"
            >
              <CopyIcon className="w-4 h-4 text-gray-400" />
              Duplicate
            </button>
            <button
              onClick={handleDelete}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1">Duplicate Proposal</h2>
            <p className="text-sm text-gray-500 mb-5">
              Reuses everything from &quot;{proposal.company_name}&quot; (scope, deliverables, timeline,
              pricing) for a new client. You can regenerate whichever sections need to change afterward.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Client Name *</label>
                <input
                  value={form.client_name}
                  onChange={(e) => update("client_name", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Client Email *</label>
                <input
                  type="email"
                  value={form.client_email}
                  onChange={(e) => update("client_email", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Company Name *</label>
                <input
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Call</label>
                <input
                  type="date"
                  value={form.date_of_call}
                  onChange={(e) => update("date_of_call", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Salesperson Name *</label>
                <input
                  value={form.salesperson_name}
                  onChange={(e) => update("salesperson_name", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                disabled={busy}
                className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-black/[0.04] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicate}
                disabled={
                  busy || !form.client_name || !form.client_email || !form.company_name || !form.salesperson_name
                }
                className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "Duplicating…" : "Duplicate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
