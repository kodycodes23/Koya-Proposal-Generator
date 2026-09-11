import { Resend } from "resend";
import type { Proposal } from "@/lib/types";

const resend = new Resend(process.env.RESEND_API_KEY);

// Matches "email@example.com" or "Name <email@example.com>" - the same shape
// Resend requires. Checked before every send (not just at module load) so a
// misconfigured or stale env value fails with a clear, actionable message
// pointing at .env.local, instead of a generic third-party validation error
// that gives no hint *why* the address is wrong.
const FROM_FORMAT = /^(?:[^<>]+<[^\s<>@]+@[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+)$/;

function resolveFromAddress(): string {
  const from = (process.env.EMAIL_FROM || "Koya Talent <onboarding@resend.dev>").trim();
  if (!FROM_FORMAT.test(from)) {
    throw new Error(
      `EMAIL_FROM is misconfigured: "${from}" is not a valid sender address. Expected "email@example.com" or ` +
        `"Name <email@example.com>". Check .env.local - if you just edited it, restart the dev server, since ` +
        `env vars are only read once at startup.`
    );
  }
  return from;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendProposalEmail({
  proposal,
  pdfBuffer,
  proposalLink,
}: {
  proposal: Proposal;
  pdfBuffer: Buffer;
  proposalLink: string;
}) {
  const linkText = `${proposal.company_name} Proposal`;

  const text = `Hi ${proposal.client_name},

Thanks again for taking the time to speak with us. Based on our conversation, we have put together a customized proposal for your review.

You can view the proposal here: ${linkText} - ${proposalLink}

This document outlines the project scope, timeline, pricing details, and recommended approach.

If you have any questions or would like to make adjustments, feel free to reach out. We are happy to iterate with you.

Looking forward to hearing your thoughts.

Best regards,

${proposal.salesperson_name}

Koya Talent`;

  const html = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #18181b;">
<p>Hi ${escapeHtml(proposal.client_name)},</p>
<p>Thanks again for taking the time to speak with us. Based on our conversation, we have put together a customized proposal for your review.</p>
<p>You can view the proposal here: <a href="${proposalLink}" style="color: #4f46e5; text-decoration: underline;">${escapeHtml(linkText)}</a></p>
<p>This document outlines the project scope, timeline, pricing details, and recommended approach.</p>
<p>If you have any questions or would like to make adjustments, feel free to reach out. We are happy to iterate with you.</p>
<p>Looking forward to hearing your thoughts.</p>
<p>Best regards,<br>${escapeHtml(proposal.salesperson_name)}<br>Koya Talent</p>
</div>`;

  const { data, error } = await resend.emails.send({
    from: resolveFromAddress(),
    to: proposal.client_email,
    replyTo: process.env.EMAIL_REPLY_TO,
    subject: `Proposal for ${proposal.company_name}`,
    html,
    text,
    attachments: [
      {
        filename: `Proposal - ${proposal.company_name}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Resend failed to send the email");
  }
  return data;
}
