import path from "path";
import { Document, Page, Text, View, StyleSheet, Svg, Circle, Image, renderToBuffer } from "@react-pdf/renderer";
import type { Proposal, ProposalSection, PricingData } from "@/lib/types";
import {
  donutSlices,
  formatAmount,
  pricingHasNumericBreakdown,
  resolveDeliverables,
  resolvePricing,
  resolveTimeline,
  timelineSegmentWidths,
} from "@/lib/sections";

const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

const INK = "#18181b";
const MUTED = "#71717a";
const ACCENT = "#3730a3";
const RULE = "#e4e4e7";
// Single accent hue, stepped light -> dark - a real proportion chart,
// deliberately monochrome rather than a multi-color rainbow.
const SHADES = ["#3730a3", "#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"];

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", lineHeight: 1.5, color: INK },

  coverPage: { padding: 56, fontFamily: "Helvetica", color: INK, flexDirection: "column" },
  coverAccentBar: { height: 5, backgroundColor: ACCENT },
  coverLogo: { width: 36, height: 36, marginTop: 32, marginBottom: 40 },
  coverBody: { flexGrow: 1, justifyContent: "center" },
  coverEyebrow: { fontSize: 10, color: ACCENT, textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 },
  coverBigTitle: { fontSize: 32, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  coverCompany: { fontSize: 14, color: MUTED, marginBottom: 28 },
  coverRule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 16, width: 120 },
  coverMetaLine: { fontSize: 10.5, color: MUTED, marginBottom: 3 },
  coverFooter: { fontSize: 9.5, color: MUTED },

  section: { marginBottom: 20 },
  heading: { fontSize: 12.5, fontFamily: "Helvetica-Bold", marginBottom: 8, color: INK },
  body: { fontSize: 10.5 },

  checklistRow: { flexDirection: "row", marginBottom: 8 },
  checkGlyph: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: ACCENT,
    color: "#ffffff",
    fontSize: 8,
    textAlign: "center",
    marginRight: 8,
    marginTop: 1,
  },
  checklistText: { flex: 1 },
  itemTitle: { fontFamily: "Helvetica-Bold", marginBottom: 1 },

  ganttBarTrack: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 12 },
  legendRow: { flexDirection: "row", marginBottom: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8, marginTop: 2 },
  legendText: { flex: 1 },
  legendName: { fontFamily: "Helvetica-Bold", marginBottom: 1 },

  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: RULE, paddingVertical: 5 },
  colLabel: { width: "40%", fontFamily: "Helvetica-Bold" },
  colDetail: { width: "40%", color: MUTED },
  colAmount: { width: "20%", textAlign: "right" },
  tableHeaderText: { fontSize: 9, color: MUTED, fontFamily: "Helvetica-Bold" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: { fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  totalValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: ACCENT },

  donutRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  donutWrap: { width: 90, height: 90 },

  signature: { marginTop: 6 },
});

function DeliverablesChecklist({ items }: { items: { title: string; description: string }[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={styles.checklistRow} wrap={false}>
          <Text style={styles.checkGlyph}>✓</Text>
          <View style={styles.checklistText}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={{ color: MUTED }}>{item.description}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

function TimelineBlock({ phases }: { phases: { name: string; duration: string; description: string }[] }) {
  const showBar = phases.length >= 2;
  const widths = showBar ? timelineSegmentWidths({ phases }) : [];
  return (
    <View>
      {showBar && (
        <View style={styles.ganttBarTrack} wrap={false}>
          {phases.map((_, i) => (
            <View key={i} style={{ width: `${widths[i] * 100}%`, backgroundColor: SHADES[i % SHADES.length] }} />
          ))}
        </View>
      )}
      {phases.map((phase, i) => (
        <View key={i} style={styles.legendRow} wrap={false}>
          {showBar && <View style={[styles.legendDot, { backgroundColor: SHADES[i % SHADES.length] }]} />}
          <View style={styles.legendText}>
            <Text style={styles.legendName}>
              {phase.name}
              {phase.duration ? ` · ${phase.duration}` : ""}
            </Text>
            <Text style={{ color: MUTED }}>{phase.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PricingBlock({ pricing }: { pricing: PricingData }) {
  const showTable = pricing.line_items.length >= 2;
  const showDonut = pricingHasNumericBreakdown(pricing);
  const total = pricing.line_items.reduce((sum, li) => sum + (li.amount || 0), 0);
  const r = 35;
  const circumference = 2 * Math.PI * r;
  const slices = showDonut
    ? donutSlices(
        pricing.line_items.map((li) => ({ fraction: (li.amount || 0) / total })),
        circumference
      )
    : [];

  return (
    <View>
      {showTable && (
        <>
          <View style={styles.tableHeaderRow} wrap={false}>
            <Text style={[styles.colLabel, styles.tableHeaderText]}>Item</Text>
            <Text style={[styles.colDetail, styles.tableHeaderText]}>Detail</Text>
            <Text style={[styles.colAmount, styles.tableHeaderText]}>Amount</Text>
          </View>
          {pricing.line_items.map((li, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={styles.colLabel}>{li.label}</Text>
              <Text style={styles.colDetail}>{li.detail}</Text>
              <Text style={styles.colAmount}>{li.amount != null ? formatAmount(li.amount) : "—"}</Text>
            </View>
          ))}
        </>
      )}

      {showDonut && (
        <View style={[styles.donutRow, { marginTop: showTable ? 12 : 0 }]}>
          <Svg width={styles.donutWrap.width} height={styles.donutWrap.height} viewBox="0 0 100 100">
            {slices.map((s, i) => (
              <Circle
                key={i}
                cx={50}
                cy={50}
                r={r}
                stroke={SHADES[i % SHADES.length]}
                strokeWidth={15}
                fill="none"
                strokeLinecap="butt"
                strokeDasharray={s.dasharray}
                transform={`rotate(${s.rotate} 50 50)`}
              />
            ))}
          </Svg>
          <View style={{ flex: 1, marginLeft: 16 }}>
            {pricing.line_items.map((li, i) => (
              <View key={i} style={styles.legendRow} wrap={false}>
                <View style={[styles.legendDot, { backgroundColor: SHADES[i % SHADES.length] }]} />
                <View style={styles.legendText}>
                  <Text style={styles.legendName}>
                    {li.label} · {Math.round(((li.amount || 0) / total) * 100)}%
                  </Text>
                  <Text style={{ color: MUTED }}>
                    {li.detail} — {formatAmount(li.amount || 0)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.totalRow} wrap={false}>
        <Text style={styles.totalLabel}>Total Investment</Text>
        <Text style={styles.totalValue}>
          {pricing.total != null ? formatAmount(pricing.total) : pricing.total_label}
        </Text>
      </View>
    </View>
  );
}

function ProposalDocument({
  proposal,
  sectionRows,
}: {
  proposal: Proposal;
  sectionRows: Record<string, ProposalSection>;
}) {
  const deliverablesRow = sectionRows.deliverables;
  const timelineRow = sectionRows.timeline;
  const pricingRow = sectionRows.pricing;

  return (
    <Document>
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverAccentBar} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is a PDF primitive, not an HTML <img> */}
        <Image src={LOGO_PATH} style={styles.coverLogo} />
        <View style={styles.coverBody}>
          <Text style={styles.coverEyebrow}>Proposal</Text>
          <Text style={styles.coverBigTitle}>{proposal.client_name}</Text>
          <Text style={styles.coverCompany}>{proposal.company_name}</Text>
          <View style={styles.coverRule} />
          <Text style={styles.coverMetaLine}>Prepared by {proposal.salesperson_name}</Text>
          <Text style={styles.coverMetaLine}>
            {proposal.date_of_call || new Date().toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.coverFooter}>Koya Talent</Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.heading}>1. Introduction</Text>
          <Text style={styles.body}>{sectionRows.introduction?.content || ""}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>2. Proposed Solution</Text>
          <Text style={styles.body}>{sectionRows.proposed_solution?.content || ""}</Text>
        </View>

        <View style={styles.section} wrap>
          <Text style={styles.heading}>3. Deliverables</Text>
          {deliverablesRow?.structured ? (
            <DeliverablesChecklist items={resolveDeliverables(deliverablesRow).items} />
          ) : (
            <Text style={styles.body}>{deliverablesRow?.content || ""}</Text>
          )}
        </View>

        <View style={styles.section} wrap>
          <Text style={styles.heading}>4. Timeline</Text>
          {timelineRow?.structured ? (
            <TimelineBlock phases={resolveTimeline(timelineRow).phases} />
          ) : (
            <Text style={styles.body}>{timelineRow?.content || ""}</Text>
          )}
        </View>

        <View style={styles.section} wrap>
          <Text style={styles.heading}>5. Pricing</Text>
          {pricingRow?.structured ? (
            <PricingBlock pricing={resolvePricing(pricingRow)} />
          ) : (
            <Text style={styles.body}>{pricingRow?.content || ""}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>6. Next Steps</Text>
          <Text style={styles.body}>{sectionRows.next_steps?.content || ""}</Text>
        </View>

        <View style={styles.signature}>
          <Text style={styles.body}>Warm regards,</Text>
          <Text style={styles.body}>{proposal.salesperson_name}</Text>
          <Text style={styles.body}>Koya Talent</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderProposalPdf(
  proposal: Proposal,
  sectionRows: ProposalSection[]
): Promise<Buffer> {
  const byKey = Object.fromEntries(sectionRows.map((r) => [r.section_key, r]));
  return renderToBuffer(<ProposalDocument proposal={proposal} sectionRows={byKey} />);
}
