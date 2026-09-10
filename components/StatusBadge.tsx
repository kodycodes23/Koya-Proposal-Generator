import type { ProposalStatus } from "@/lib/types";

const DOT: Record<ProposalStatus, string> = {
  draft: "bg-gray-400",
  pending_approval: "bg-amber-500",
  approved: "bg-blue-500",
  rejected: "bg-red-500",
  sent: "bg-emerald-500",
  send_failed: "bg-red-500",
};

const TEXT: Record<ProposalStatus, string> = {
  draft: "text-gray-600",
  pending_approval: "text-amber-700",
  approved: "text-blue-700",
  rejected: "text-red-700",
  sent: "text-emerald-700",
  send_failed: "text-red-700",
};

const LABELS: Record<ProposalStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  sent: "Sent",
  send_failed: "Send Failed",
};

export function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium ${TEXT[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LABELS[status]}
    </span>
  );
}
