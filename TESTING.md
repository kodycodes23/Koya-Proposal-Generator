# Testing Evidence

App running at http://localhost:3000 (`npm run dev`). Walk through each scenario below in the
browser, then fill in **Actual Result** and **Pass/Fail** as you go.

---

## 1. Normal Proposal Generation

**Steps:** Go to `/new`. Fill in every field with the sample data below and click **Generate Proposal**.

```
Client Name:              Maria Chen
Client Email:             agorua.kody@gmail.com
Company Name:             Brightline Logistics
Date of Call:             2026-09-01
Salesperson Name:         Jordan Reyes
Summary of Client's Needs: Brightline's dispatch team manually re-keys shipment data between
                           their TMS and their carrier portals, costing about 15 hours per week
                           and causing occasional data-entry errors.
Project Scope:            Build an integration layer that syncs shipment records between
                           Brightline's TMS (Samsara) and their top 3 carrier portals
                           automatically, with a dashboard to review sync exceptions.
Goals and Objectives:     Cut manual data entry time by at least 80% and reduce shipment data
                           errors that cause billing disputes.
Recommended Services:     Custom integration build, exception-handling dashboard, 2 weeks of
                           hypercare support post-launch.
Proposed Timeline:        6 weeks: 2 weeks discovery/build, 2 weeks integration testing with
                           carriers, 2 weeks hypercare.
Estimated Pricing:        $28,000 flat fee, billed in two milestones.
```

**Expected result:** Redirects to the proposal workspace. All six sections (Introduction,
Proposed Solution, Deliverables, Timeline, Pricing, Next Steps) are filled in, read clearly,
reference the specifics above (Samsara, 6 weeks, $28,000, etc.), and there is **no** "Missing
information flagged" banner.

**Actual result:**

**Pass/Fail:**

---

## 2. Missing Information

**Steps:** Go to `/new` again. Fill in only the required fields (Client Name, Client Email,
Company Name, Salesperson Name) and leave **Goals and Objectives** and **Estimated Pricing**
blank. Fill the rest in lightly. Click **Generate Proposal**.

```
Client Name:      Tom Alvarez
Client Email:     agorua.kody@gmail.com
Company Name:     Alvarez & Co
Salesperson Name: Jordan Reyes
Project Scope:    A new customer support workflow.
(leave Goals and Objectives, Proposed Timeline, Estimated Pricing blank)
```

**Expected result:** A "Missing information flagged" banner appears listing the gaps (pricing,
timeline, goals). Inside the Pricing/Timeline sections you should see the literal placeholder
text `[NEEDS INPUT: ...]` rather than an invented number or date — the app should never make up
a price or deadline that wasn't given.

**Actual result:**

**Pass/Fail:**

---

## 3. Supporting Material

**Steps:** Go to `/new`. Fill in the same fields as Scenario 1 (or similar), and this time paste
something concrete into **Supporting Material / Call Notes**, e.g.:

```
Call notes: Client mentioned they're currently using spreadsheets and a shared Google Drive
folder to track shipments. Their biggest pain point is that carrier portal exports use
different column formats, so someone manually reconciles them every Friday. They specifically
asked whether we could support DHL and FedEx portals first, since those are 80% of their volume.
```

**Expected result:** The generated Proposed Solution / Deliverables sections reference these
specifics (spreadsheets/Drive workaround, DHL/FedEx priority, Friday reconciliation) rather than
generic boilerplate — showing the supporting material was actually used, not ignored.

**Actual result:**

**Pass/Fail:**

---

## 4. Section Regeneration

**Steps:** Open the proposal from Scenario 1. Note the current text of the **Deliverables** and
**Timeline** sections (for comparison). In the **Pricing** section, type an instruction like
`Break the pricing into two milestone payments` into the small instruction box next to
"Regenerate", then click **Regenerate**.

**Expected result:** Only the Pricing section's text changes (and its version number
increments, e.g. v1 → v2, label still says "AI-generated"). Deliverables and Timeline sections
are untouched. A `section_regenerated` entry appears in the Activity Log at the bottom.

**Actual result:**

**Pass/Fail:**

---

## 5. Human Approval (block sending before approval)

**Steps:** On a proposal still in **Draft** or **Pending Approval** status, confirm there is no
way in the UI to send it to the client — the "Generate Final Document & Send to Client" button
only appears once status is **Approved**. As a stronger check, with the dev server running, run
this from a terminal against a proposal that is NOT yet approved (replace `<id>` with a proposal
id from its URL):

```bash
curl -i -X POST http://localhost:3000/api/proposals/<id>/send
```

**Expected result:** UI never exposes a send action pre-approval. The direct API call above
returns `400` with an error like `Cannot send from status "draft" - proposal must be approved
first` — proving the guard is enforced server-side, not just hidden in the UI.

**Actual result:**

**Pass/Fail:**

---

## 6. Final Delivery and Logging (happy path)

**Steps:** On the Scenario 1 proposal, click **Submit for Approval**. Enter an approver name
(e.g. "Sam Patel") and click **Approve**. Then click **Generate Final Document & Send to
Client** (client email must be `agorua.kody@gmail.com` — see note below).

> **Why that email specifically:** Resend's sandbox sender (`onboarding@resend.dev`, used here
> since no custom domain is verified yet) can only deliver to the Resend account's own email
> address until a domain is verified. Using any other address will fail — see Scenario 7, which
> uses that on purpose.

**Expected result:** Status becomes **Sent**, a link to the final PDF appears, and the email
arrives in the agorua.kody@gmail.com inbox with the PDF attached and the correct proposal-email
copy/subject (`Proposal for Brightline Logistics`). The Activity Log shows successful
`submitted_for_approval`, `approved`, `pdf_generated`, and `email_sent` entries in order.

**Actual result:**

**Pass/Fail:**

---

## 7. Failure Handling

**Steps:** Create and approve another proposal (repeat Scenario 1 + approval steps), but this
time set **Client Email** to any address that is *not* `agorua.kody@gmail.com` (e.g.
`test@example.com`) — this is expected to be rejected by Resend's sandbox sender restriction.
Click **Generate Final Document & Send to Client**.

**Expected result:** The UI shows a clear red error naming the failed step (e.g. "Email
delivery failed: ..."), status becomes **Send Failed** (not silently stuck or falsely marked
Sent), and the Activity Log has an `email_failed` entry with the real Resend error message in
its detail — enough to debug without digging through server logs. A **Retry Send to Client**
button should appear so the failure is recoverable once fixed (e.g. after changing the email).

**Actual result:**

**Pass/Fail:**

---

## Notes / Known Constraints

- Email sending uses Resend's sandbox sender (`onboarding@resend.dev`) since no custom domain is
  verified yet — it can only send to the Resend account owner's own address. This is why
  Scenario 6 must target `agorua.kody@gmail.com` and Scenario 7 intentionally targets a
  different address to demonstrate failure handling.
- No login/auth — this is a single-tenant internal tool; "approver" is a typed name field.
