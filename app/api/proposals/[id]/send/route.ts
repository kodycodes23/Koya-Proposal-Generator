import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";
import { renderProposalPdf } from "@/lib/pdf";
import { sendProposalEmail } from "@/lib/email";
import type { Proposal, ProposalSection } from "@/lib/types";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: proposal, error: proposalError } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (proposalError || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  // Server-side guard: never allow send without approval, regardless of
  // what the UI believes the state is. "send_failed" is allowed so a failed
  // attempt (e.g. a bounced email) can be retried without re-approving.
  if (proposal.status !== "approved" && proposal.status !== "send_failed") {
    return NextResponse.json(
      { error: `Cannot send from status "${proposal.status}" - proposal must be approved first` },
      { status: 400 }
    );
  }

  const { data: sections, error: sectionsError } = await supabaseAdmin
    .from("proposal_sections")
    .select("*")
    .eq("proposal_id", id);

  if (sectionsError || !sections) {
    return NextResponse.json({ error: sectionsError?.message }, { status: 500 });
  }

  const typedProposal = proposal as Proposal;
  const typedSections = sections as ProposalSection[];

  // 1. Generate the PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderProposalPdf(typedProposal, typedSections);
    await logEvent(id, "pdf_generated", "success", {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown PDF generation error";
    await logEvent(id, "pdf_failed", "failure", { error: message });
    return NextResponse.json({ error: `PDF generation failed: ${message}` }, { status: 500 });
  }

  // 2. Upload to Supabase Storage and get a signed URL
  const pdfPath = `${id}/${Date.now()}.pdf`;
  let signedUrl: string;
  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from("proposal-pdfs")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from("proposal-pdfs")
      .createSignedUrl(pdfPath, SIGNED_URL_EXPIRY_SECONDS);
    if (signError || !signedData) throw new Error(signError?.message || "Failed to sign URL");

    signedUrl = signedData.signedUrl;
    await supabaseAdmin
      .from("proposals")
      .update({ pdf_path: pdfPath, pdf_url: signedUrl })
      .eq("id", id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown storage error";
    await logEvent(id, "pdf_failed", "failure", { error: message });
    return NextResponse.json({ error: `Storing the PDF failed: ${message}` }, { status: 500 });
  }

  // 3. Send the email via Resend
  try {
    await sendProposalEmail({ proposal: typedProposal, pdfBuffer, proposalLink: signedUrl });
    await logEvent(id, "email_sent", "success", { to: typedProposal.client_email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    await logEvent(id, "email_failed", "failure", { to: typedProposal.client_email, error: message });
    await supabaseAdmin.from("proposals").update({ status: "send_failed" }).eq("id", id);
    return NextResponse.json({ error: `Email delivery failed: ${message}` }, { status: 502 });
  }

  // 4. Mark as sent
  const { error: updateError } = await supabaseAdmin
    .from("proposals")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    // The email was already sent - the client has their proposal. Log the
    // logging/state-update failure loudly so it's caught and fixed, but
    // don't tell the user delivery failed when it didn't.
    await logEvent(id, "log_note", "failure", {
      error: `Email sent but failed to update status: ${updateError.message}`,
    });
    return NextResponse.json(
      {
        warning:
          "Email was sent to the client, but the proposal status failed to update. Check the activity log.",
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ ok: true, pdf_url: signedUrl });
}
