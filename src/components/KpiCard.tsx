interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "brand" | "green" | "red" | "neutral";
}

const accentClasses: Record<string, string> = {
  brand: "text-brand-600",
  green: "text-green-600",
  red: "text-red-500",
  neutral: "text-neutral-800",
};

export default function KpiCard({ label, value, sublabel, accent = "neutral" }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-neutral-100">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accentClasses[accent]}`}>{value}</div>
      {sublabel && <div className="text-xs text-neutral-400 mt-1">{sublabel}</div>}
    </div>
  );
}
