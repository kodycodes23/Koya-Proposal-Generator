import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { ProposalActionsMenu } from "@/components/ProposalActionsMenu";
import type { Proposal } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type EventRow = {
  id: string;
  proposal_id: string;
  event_type: string;
  status: "success" | "failure";
  detail: Record<string, unknown>;
  created_at: string;
  proposals: { company_name: string; client_name: string } | null;
};

const card = "rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden";

function Tabs({ active }: { active: "proposals" | "activity" }) {
  const tabClass = (tab: string) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
      active === tab ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
    }`;
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white p-1 shadow-sm">
      <Link href="/activity?tab=proposals" className={tabClass("proposals")}>
        Proposals
      </Link>
      <Link href="/activity?tab=activity" className={tabClass("activity")}>
        Activity
      </Link>
    </div>
  );
}

function Pagination({ tab, page, totalPages }: { tab: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-black/[0.06] text-sm">
      <Link
        href={`/activity?tab=${tab}&page=${page - 1}`}
        aria-disabled={page <= 1}
        className={`font-medium ${page <= 1 ? "pointer-events-none text-gray-300" : "text-gray-600 hover:text-gray-900"}`}
      >
        ← Previous
      </Link>
      <span className="text-xs text-gray-400">
        Page {page} of {totalPages}
      </span>
      <Link
        href={`/activity?tab=${tab}&page=${page + 1}`}
        aria-disabled={page >= totalPages}
        className={`font-medium ${page >= totalPages ? "pointer-events-none text-gray-300" : "text-gray-600 hover:text-gray-900"}`}
      >
        Next →
      </Link>
    </div>
  );
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const params = await searchParams;
  const tab: "proposals" | "activity" = params.tab === "activity" ? "activity" : "proposals";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let proposals: Proposal[] = [];
  let events: EventRow[] = [];
  let totalCount = 0;
  let error: string | null = null;

  if (tab === "proposals") {
    const { data, count, error: err } = await supabaseAdmin
      .from("proposals")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    proposals = (data || []) as Proposal[];
    totalCount = count || 0;
    error = err?.message || null;
  } else {
    const { data, count, error: err } = await supabaseAdmin
      .from("proposal_events")
      .select("id, proposal_id, event_type, status, detail, created_at, proposals(company_name, client_name)", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, to);
    events = (data || []) as unknown as EventRow[];
    totalCount = count || 0;
    error = err?.message || null;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl w-full px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {tab === "proposals" ? "All Proposals" : "All Activity"}
          </h1>
          <p className="text-sm text-gray-500">{totalCount} total</p>
        </div>
        <Tabs active={tab} />
      </div>

      <div className={card}>
        {error && <p className="text-red-600 text-sm px-5 py-4">Failed to load: {error}</p>}

        {tab === "proposals" ? (
          <>
            {proposals.length === 0 && !error && (
              <p className="text-gray-500 text-sm px-5 py-6">No proposals yet.</p>
            )}
            <div className="divide-y divide-black/[0.05]">
              {proposals.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-5 py-3.5 hover:bg-black/[0.02] transition-colors">
                  <Link href={`/proposals/${p.id}`} className="flex flex-1 items-center gap-3 justify-between min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={p.company_name} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.company_name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {p.client_name} · {p.salesperson_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-3">
                      <span className="text-xs text-gray-400 hidden sm:inline">
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                  </Link>
                  <ProposalActionsMenu proposal={p} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {events.length === 0 && !error && (
              <p className="text-gray-500 text-sm px-5 py-6">No activity yet.</p>
            )}
            <ul className="divide-y divide-black/[0.05]">
              {events.map((e) => (
                <li key={e.id} className={e.status === "failure" ? "bg-red-50/60" : ""}>
                  <Link href={`/proposals/${e.proposal_id}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-black/[0.02]">
                    <Avatar name={e.proposals?.company_name || "?"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${e.status === "failure" ? "text-red-700" : ""}`}>
                          {e.event_type.replaceAll("_", " ")}
                          {e.status === "failure" && " — failed"}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{e.proposals?.company_name || "—"}</p>
                      {Object.keys(e.detail || {}).length > 0 && (
                        <pre className="text-xs text-gray-500 mt-1.5 whitespace-pre-wrap break-words">
                          {JSON.stringify(e.detail, null, 2)}
                        </pre>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <Pagination tab={tab} page={page} totalPages={totalPages} />
      </div>
    </main>
  );
}
