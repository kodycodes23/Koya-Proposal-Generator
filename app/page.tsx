import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { StatTile } from "@/components/StatTile";
import { Avatar } from "@/components/Avatar";
import { ProposalActionsMenu } from "@/components/ProposalActionsMenu";
import { DocumentIcon, SendIcon, HourglassIcon, ClockIcon } from "@/components/icons";
import type { Proposal } from "@/lib/types";

const SPARKLINE_DAYS = 14;

function dailyCounts(proposals: Proposal[], days: number): number[] {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const counts = new Array(days).fill(0);
  for (const p of proposals) {
    const dayIndex = Math.round((today - startOfDay(new Date(p.created_at))) / (24 * 60 * 60 * 1000));
    const bucket = days - 1 - dayIndex;
    if (bucket >= 0 && bucket < days) counts[bucket]++;
  }
  return counts;
}

export const dynamic = "force-dynamic";

type EventWithProposal = {
  id: string;
  event_type: string;
  status: "success" | "failure";
  created_at: string;
  proposals: { company_name: string; client_name: string } | null;
};

function formatDuration(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(ms / (1000 * 60))}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default async function Home() {
  const [{ data, error }, { data: recentEvents }] = await Promise.all([
    supabaseAdmin.from("proposals").select("*").order("created_at", { ascending: false }),
    supabaseAdmin
      .from("proposal_events")
      .select("id, event_type, status, created_at, proposals(company_name, client_name)")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const proposals = (data || []) as Proposal[];
  const events = (recentEvents || []) as unknown as EventWithProposal[];

  const total = proposals.length;
  const sent = proposals.filter((p) => p.status === "sent");
  const pending = proposals.filter((p) => p.status === "pending_approval").length;
  const oneWeekAgo = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
  const createdThisWeek = proposals.filter((p) => new Date(p.created_at).getTime() >= oneWeekAgo).length;

  const turnarounds = sent
    .filter((p) => p.sent_at)
    .map((p) => new Date(p.sent_at as string).getTime() - new Date(p.created_at).getTime());
  const avgTurnaround =
    turnarounds.length > 0 ? formatDuration(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) : "—";

  const sparkline = dailyCounts(proposals, SPARKLINE_DAYS);

  return (
    <main className="mx-auto max-w-6xl w-full px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500">Every proposal, its status, and what happened along the way.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile
          label="Total Proposals"
          value={String(total)}
          sub={`${createdThisWeek} created this week`}
          primary
          icon={<DocumentIcon />}
          sparkline={sparkline}
        />
        <StatTile label="Sent" value={String(sent.length)} icon={<SendIcon />} />
        <StatTile label="Pending Approval" value={String(pending)} icon={<HourglassIcon />} />
        <StatTile label="Avg. Turnaround" value={avgTurnaround} sub="draft → sent" icon={<ClockIcon />} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
            <h2 className="font-semibold text-sm">Recent Proposals</h2>
            <Link href="/activity?tab=proposals" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
              See all ({total}) →
            </Link>
          </div>

          {error && <p className="text-red-600 text-sm px-5 py-4">Failed to load proposals: {error.message}</p>}

          {proposals.length === 0 && !error && (
            <p className="text-gray-500 text-sm px-5 py-6">
              No proposals yet. Click &quot;New Proposal&quot; to create one from intake notes.
            </p>
          )}

          <div className="divide-y divide-black/[0.05]">
            {proposals.slice(0, 8).map((p) => (
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
        </div>

        <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
            <h2 className="font-semibold text-sm">Recent Activity</h2>
            <Link href="/activity?tab=activity" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
              See all →
            </Link>
          </div>
          <ul className="divide-y divide-black/[0.05]">
            {events.map((e) => (
              <li key={e.id} className="px-5 py-3.5">
                <div className="flex items-start gap-3 justify-between">
                  <Avatar name={e.proposals?.company_name || "?"} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${e.status === "failure" ? "text-red-600" : ""}`}>
                      {e.event_type.replaceAll("_", " ")}
                      {e.status === "failure" && " failed"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {e.proposals?.company_name || "—"} · {new Date(e.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </li>
            ))}
            {events.length === 0 && <li className="px-5 py-6 text-sm text-gray-400">No activity yet.</li>}
          </ul>
        </div>
      </div>
    </main>
  );
}
