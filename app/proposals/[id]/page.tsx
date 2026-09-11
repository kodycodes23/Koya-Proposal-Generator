import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ProposalWorkspace } from "@/components/ProposalWorkspace";
import { ROLE_COOKIE, parseRole } from "@/lib/role";
import type { Proposal, ProposalSection, ProposalEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const role = parseRole(cookieStore.get(ROLE_COOKIE)?.value);

  const [{ data: proposal }, { data: sections }, { data: events }] = await Promise.all([
    supabaseAdmin.from("proposals").select("*").eq("id", id).single(),
    supabaseAdmin.from("proposal_sections").select("*").eq("proposal_id", id).order("section_key"),
    supabaseAdmin
      .from("proposal_events")
      .select("*")
      .eq("proposal_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!proposal) {
    notFound();
  }

  return (
    <ProposalWorkspace
      initialProposal={proposal as Proposal}
      initialSections={(sections || []) as ProposalSection[]}
      initialEvents={(events || []) as ProposalEvent[]}
      role={role}
    />
  );
}
