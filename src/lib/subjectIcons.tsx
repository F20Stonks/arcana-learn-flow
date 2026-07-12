import {
  Sigma,
  Atom,
  FlaskConical,
  Dna,
  Cpu,
  Radio,
  Rocket,
  Landmark,
  Globe2,
  BookOpen,
  Palette,
  Music2,
  Brain,
  Scale,
  Coins,
  Languages,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

interface SubjectIconMeta {
  icon: LucideIcon;
  color: string;
}

// Keyword-matched, not exhaustive — falls back to a solid default for anything unmatched so no
// subject ever renders blank. Ordered most-specific-first where keywords could otherwise collide
// (e.g. "further math" before the generic "math").
const SUBJECT_ICON_MAP: Array<{ keywords: string[] } & SubjectIconMeta> = [
  { keywords: ["math", "calculus", "algebra", "statistics", "arithmetic", "geometry"], icon: Sigma, color: "#818cf8" },
  { keywords: ["physics", "mechanics", "quantum", "relativity", "consciousness"], icon: Atom, color: "#38bdf8" },
  { keywords: ["chemistry", "chem"], icon: FlaskConical, color: "#4ade80" },
  { keywords: ["biology", "bio", "genetic"], icon: Dna, color: "#34d399" },
  { keywords: ["computer science", "programming", "software", "coding", "algorithm"], icon: Cpu, color: "#a78bfa" },
  { keywords: ["electronic", "circuit", "amplifier", "pcb", "engineering", "signal"], icon: Radio, color: "#fb923c" },
  { keywords: ["aerospace", "aviation", "rocket", "orbital"], icon: Rocket, color: "#f87171" },
  { keywords: ["history"], icon: Landmark, color: "#eab308" },
  { keywords: ["geography"], icon: Globe2, color: "#22d3ee" },
  { keywords: ["english", "literature", "writing"], icon: BookOpen, color: "#f472b6" },
  { keywords: ["art", "design"], icon: Palette, color: "#fb7185" },
  { keywords: ["music"], icon: Music2, color: "#c084fc" },
  { keywords: ["psychology", "cognitive", "philosophy"], icon: Brain, color: "#e879f9" },
  { keywords: ["law", "legal"], icon: Scale, color: "#94a3b8" },
  { keywords: ["economics", "business", "finance"], icon: Coins, color: "#facc15" },
  { keywords: ["language", "linguistics"], icon: Languages, color: "#5eead4" },
];

const DEFAULT_ICON: SubjectIconMeta = { icon: GraduationCap, color: "#818cf8" };

export function getSubjectIconMeta(subject?: string | null): SubjectIconMeta {
  const s = (subject || "").toLowerCase();
  for (const entry of SUBJECT_ICON_MAP) {
    if (entry.keywords.some((k) => s.includes(k))) return entry;
  }
  return DEFAULT_ICON;
}

const SIZE_CLASSES = {
  sm: { box: "h-8 w-8 rounded-lg", icon: "h-4 w-4" },
  md: { box: "h-10 w-10 rounded-xl", icon: "h-5 w-5" },
  lg: { box: "h-14 w-14 rounded-2xl", icon: "h-7 w-7" },
} as const;

export function SubjectIcon({
  subject,
  size = "md",
  className = "",
}: {
  subject?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const { icon: Icon, color } = getSubjectIconMeta(subject);
  const dims = SIZE_CLASSES[size];
  return (
    <div
      className={`${dims.box} flex items-center justify-center shrink-0 ${className}`}
      style={{ background: `${color}1f` }}
    >
      <Icon className={dims.icon} style={{ color }} />
    </div>
  );
}
