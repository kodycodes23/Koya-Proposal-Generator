import { SECTION_LABELS } from "@/lib/types";
import type { Proposal, ProposalSection, SectionKey } from "@/lib/types";
import {
  donutSlices,
  formatAmount,
  pricingHasNumericBreakdown,
  resolveDeliverables,
  resolvePricing,
  resolveTimeline,
  timelineSegmentWidths,
} from "@/lib/sections";
import { SECTION_ICONS } from "@/components/sectionIcons";

const SHADES = ["#4338ca", "#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"];

function SectionLabel({ section }: { section: SectionKey }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
      <span className="text-indigo-400">{SECTION_ICONS[section]}</span>
      {SECTION_LABELS[section]}
    </p>
  );
}

function Prose({ text }: { text: string }) {
  return <p className="text-[13.5px] leading-relaxed text-gray-700 whitespace-pre-wrap">{text || "—"}</p>;
}

export function ProposalPreview({
  proposal,
  sections,
}: {
  proposal: Proposal;
  sections: ProposalSection[];
}) {
  const byKey = Object.fromEntries(sections.map((s) => [s.section_key, s]));

  const deliverables = byKey.deliverables?.structured ? resolveDeliverables(byKey.deliverables) : null;
  const timeline = byKey.timeline?.structured ? resolveTimeline(byKey.timeline) : null;
  const pricing = byKey.pricing?.structured ? resolvePricing(byKey.pricing) : null;

  const showDonut = pricing ? pricingHasNumericBreakdown(pricing) : false;
  const pricingTotal = showDonut && pricing ? pricing.line_items.reduce((sum, li) => sum + (li.amount || 0), 0) : 0;
  const timelineWidths = timeline && timeline.phases.length >= 2 ? timelineSegmentWidths(timeline) : [];

  const r = 45;
  const circumference = 2 * Math.PI * r;
  const slices =
    showDonut && pricing
      ? donutSlices(
          pricing.line_items.map((li) => ({ fraction: (li.amount || 0) / pricingTotal })),
          circumference
        )
      : [];

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-8 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 mb-3">Client Preview</p>

      <h2 className="text-xl font-semibold tracking-tight">Proposal for {proposal.client_name}</h2>
      <p className="text-sm text-gray-500 mt-0.5">{proposal.company_name}</p>
      <p className="text-xs text-gray-400 mt-2">
        Prepared by {proposal.salesperson_name} · {proposal.date_of_call || new Date().toLocaleDateString()}
      </p>

      <div className="border-t border-black/[0.06] mt-5 mb-6" />

      <section className="mb-6">
        <SectionLabel section="introduction" />
        <Prose text={byKey.introduction?.content || ""} />
      </section>

      <section className="mb-6">
        <SectionLabel section="proposed_solution" />
        <Prose text={byKey.proposed_solution?.content || ""} />
      </section>

      <section className="mb-6">
        <SectionLabel section="deliverables" />
        {deliverables ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {deliverables.items.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold mt-0.5">
                  ✓
                </span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
            {deliverables.items.length === 0 && <p className="text-sm text-gray-400">—</p>}
          </div>
        ) : (
          <Prose text={byKey.deliverables?.content || ""} />
        )}
      </section>

      <section className="mb-6">
        <SectionLabel section="timeline" />
        {timeline ? (
          <div>
            {timeline.phases.length >= 2 && (
              <div className="flex h-2 w-full overflow-hidden rounded-full mb-3">
                {timeline.phases.map((_, i) => (
                  <div
                    key={i}
                    style={{ width: `${timelineWidths[i] * 100}%`, backgroundColor: SHADES[i % SHADES.length] }}
                  />
                ))}
              </div>
            )}
            <div className="space-y-2.5">
              {timeline.phases.map((phase, i) => (
                <div key={i} className="flex items-start gap-2">
                  {timeline.phases.length >= 2 && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full mt-1.5"
                      style={{ backgroundColor: SHADES[i % SHADES.length] }}
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {phase.name}
                      {phase.duration && <span className="text-gray-400 font-normal"> · {phase.duration}</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{phase.description}</p>
                  </div>
                </div>
              ))}
              {timeline.phases.length === 0 && <p className="text-sm text-gray-400">—</p>}
            </div>
          </div>
        ) : (
          <Prose text={byKey.timeline?.content || ""} />
        )}
      </section>

      <section className="mb-6">
        <SectionLabel section="pricing" />
        {pricing ? (
          <>
            {pricing.line_items.length >= 2 && (
              <table className="w-full text-sm border-collapse mb-4">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium">Detail</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.line_items.map((li, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 font-medium align-top">{li.label}</td>
                      <td className="py-2 text-gray-500 align-top">{li.detail}</td>
                      <td className="py-2 text-right align-top whitespace-nowrap">
                        {li.amount != null ? formatAmount(li.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showDonut && (
              <div className="flex items-center gap-5 mb-4">
                <svg width={88} height={88} viewBox="0 0 120 120" className="shrink-0">
                  {slices.map((s, i) => (
                    <circle
                      key={i}
                      cx={60}
                      cy={60}
                      r={r}
                      stroke={SHADES[i % SHADES.length]}
                      strokeWidth={18}
                      fill="none"
                      strokeLinecap="butt"
                      strokeDasharray={s.dasharray}
                      transform={`rotate(${s.rotate} 60 60)`}
                    />
                  ))}
                </svg>
                <div className="flex-1 space-y-1.5">
                  {pricing.line_items.map((li, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11.5px] text-gray-600">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: SHADES[i % SHADES.length] }}
                      />
                      <span className="font-medium text-gray-800">{li.label}</span>
                      <span className="text-gray-400">
                        · {Math.round(((li.amount || 0) / pricingTotal) * 100)}% · {formatAmount(li.amount || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-black/[0.08] pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Total Investment
              </span>
              <span className="text-base font-semibold text-indigo-600">
                {pricing.total != null ? formatAmount(pricing.total) : pricing.total_label || "—"}
              </span>
            </div>
          </>
        ) : (
          <Prose text={byKey.pricing?.content || ""} />
        )}
      </section>

      <section>
        <SectionLabel section="next_steps" />
        <Prose text={byKey.next_steps?.content || ""} />
        <p className="text-sm text-gray-700 mt-4">
          Warm regards,
          <br />
          {proposal.salesperson_name}
          <br />
          Koya Talent
        </p>
      </section>
    </div>
  );
}
