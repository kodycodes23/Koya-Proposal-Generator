function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 100;
  const h = 28;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const areaPoints = `0,${h} ${points.join(" ")} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-7 mt-2">
      <polygon points={areaPoints} fill={color} opacity={0.08} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  sub,
  primary,
  icon,
  sparkline,
}: {
  label: string;
  value: string;
  sub?: string;
  primary?: boolean;
  icon: React.ReactNode;
  sparkline?: number[];
}) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${primary ? "border-indigo-100" : "border-black/[0.06]"}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            primary ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {sparkline && sparkline.some((v) => v > 0) && (
        <Sparkline data={sparkline} color={primary ? "#4f46e5" : "#9ca3af"} />
      )}
    </div>
  );
}
