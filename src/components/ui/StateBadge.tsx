// Coloured status pill; each feature maps its states to a label and tone (quote states, order states, ...).
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-800",
  info: "bg-blue-100 text-blue-900",
  success: "bg-green-100 text-green-900",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-900",
};

export function StateBadge({ state, map }: { state: string; map: Record<string, { label: string; tone: Tone }> }) {
  const { label, tone } = map[state] ?? { label: state, tone: "neutral" as Tone };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{label}</span>;
}
