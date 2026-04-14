import { useMemo } from "react";
import { Tables } from "@/integrations/supabase/types";

type Topic = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

interface KnowledgeMapProps {
  topics: Topic[];
  onSubtopicClick: (subtopicId: string) => void;
}

const STATUS_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  complete: { fill: "hsl(142, 71%, 45%)", stroke: "hsl(142, 71%, 35%)", glow: "hsl(142, 71%, 45%)" },
  in_progress: { fill: "hsl(38, 92%, 50%)", stroke: "hsl(38, 92%, 40%)", glow: "hsl(38, 92%, 50%)" },
  review_due: { fill: "hsl(0, 84%, 60%)", stroke: "hsl(0, 84%, 50%)", glow: "hsl(0, 84%, 60%)" },
  unlocked: { fill: "hsl(239, 84%, 67%)", stroke: "hsl(239, 84%, 55%)", glow: "hsl(239, 84%, 67%)" },
  locked: { fill: "hsl(0, 0%, 20%)", stroke: "hsl(0, 0%, 15%)", glow: "transparent" },
};

export default function KnowledgeMap({ topics, onSubtopicClick }: KnowledgeMapProps) {
  const layout = useMemo(() => computeLayout(topics), [topics]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full min-w-[600px]"
        style={{ maxHeight: "70vh" }}
      >
        <defs>
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <filter key={status} id={`glow-${status}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feFlood floodColor={colors.glow} floodOpacity="0.3" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>

        {/* Connection lines */}
        {layout.connections.map((conn, i) => (
          <line
            key={i}
            x1={conn.x1} y1={conn.y1}
            x2={conn.x2} y2={conn.y2}
            stroke="hsl(0, 0%, 18%)"
            strokeWidth="1.5"
            strokeDasharray={conn.locked ? "4 4" : "none"}
          />
        ))}

        {/* Topic labels */}
        {layout.topicLabels.map((label, i) => (
          <text
            key={`topic-${i}`}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider"
            style={{ fontSize: "10px", fill: "hsl(0, 0%, 53%)" }}
          >
            {label.text}
          </text>
        ))}

        {/* Subtopic nodes */}
        {layout.nodes.map((node) => {
          const colors = STATUS_COLORS[node.status] || STATUS_COLORS.locked;
          const isInteractive = node.status !== "locked";

          return (
            <g
              key={node.id}
              onClick={() => isInteractive && onSubtopicClick(node.id)}
              className={isInteractive ? "cursor-pointer" : "cursor-not-allowed"}
              style={{ transition: "transform 0.15s" }}
            >
              {/* Glow circle */}
              {node.status !== "locked" && (
                <circle
                  cx={node.x} cy={node.y} r={18}
                  fill="none"
                  stroke={colors.glow}
                  strokeWidth="1"
                  opacity="0.3"
                  filter={`url(#glow-${node.status})`}
                />
              )}

              {/* Main node */}
              <circle
                cx={node.x} cy={node.y} r={14}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth="2"
                opacity={node.status === "locked" ? 0.4 : 1}
              />

              {/* Lock icon for locked */}
              {node.status === "locked" && (
                <text
                  x={node.x} y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontSize: "10px", fill: "hsl(0, 0%, 40%)" }}
                >
                  🔒
                </text>
              )}

              {/* Checkmark for complete */}
              {node.status === "complete" && (
                <text
                  x={node.x} y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontSize: "10px", fill: "white" }}
                >
                  ✓
                </text>
              )}

              {/* Label */}
              <text
                x={node.x}
                y={node.y + 24}
                textAnchor="middle"
                style={{
                  fontSize: "9px",
                  fill: node.status === "locked" ? "hsl(0, 0%, 30%)" : "hsl(0, 0%, 70%)",
                }}
              >
                {truncate(node.title, 18)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        {[
          { label: "Complete", color: STATUS_COLORS.complete.fill },
          { label: "In Progress", color: STATUS_COLORS.in_progress.fill },
          { label: "Unlocked", color: STATUS_COLORS.unlocked.fill },
          { label: "Locked", color: STATUS_COLORS.locked.fill },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

interface NodeLayout { id: string; x: number; y: number; title: string; status: string }
interface Connection { x1: number; y1: number; x2: number; y2: number; locked: boolean }
interface TopicLabel { x: number; y: number; text: string }
interface Layout { nodes: NodeLayout[]; connections: Connection[]; topicLabels: TopicLabel[]; width: number; height: number }

function computeLayout(topics: Topic[]): Layout {
  const nodes: NodeLayout[] = [];
  const connections: Connection[] = [];
  const topicLabels: TopicLabel[] = [];

  const paddingX = 60;
  const paddingY = 50;
  const topicGap = 100;
  const nodeSpacingX = 80;
  const nodeSpacingY = 70;
  const maxPerRow = 5;

  let currentY = paddingY;

  for (const topic of topics) {
    const rows = Math.ceil(topic.subtopics.length / maxPerRow);
    const topicWidth = Math.min(topic.subtopics.length, maxPerRow) * nodeSpacingX;

    topicLabels.push({ x: paddingX + topicWidth / 2, y: currentY, text: topic.title });
    currentY += 30;

    for (let i = 0; i < topic.subtopics.length; i++) {
      const sub = topic.subtopics[i];
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const colsInRow = Math.min(topic.subtopics.length - row * maxPerRow, maxPerRow);
      const offsetX = ((maxPerRow - colsInRow) * nodeSpacingX) / 2;

      const x = paddingX + offsetX + col * nodeSpacingX + nodeSpacingX / 2;
      const y = currentY + row * nodeSpacingY;

      nodes.push({ id: sub.id, x, y, title: sub.title, status: sub.status });

      // Connect to previous subtopic
      if (i > 0) {
        const prev = nodes[nodes.length - 2];
        connections.push({
          x1: prev.x, y1: prev.y,
          x2: x, y2: y,
          locked: sub.status === "locked",
        });
      }
    }

    currentY += rows * nodeSpacingY + topicGap;
  }

  const width = Math.max(paddingX * 2 + maxPerRow * nodeSpacingX, 600);
  const height = Math.max(currentY, 300);

  return { nodes, connections, topicLabels, width, height };
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
