import { useMemo, useCallback } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, GitBranch, Zap } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { learningTracks, type Status } from "@/data/learningTracks";

const statusColor: Record<Status, string> = {
  completed: "hsl(142, 60%, 50%)",
  "in-progress": "hsl(45, 93%, 58%)",
  "not-started": "hsl(0, 0%, 40%)",
};

const statusBorder: Record<Status, string> = {
  completed: "hsl(142, 60%, 35%)",
  "in-progress": "hsl(45, 93%, 42%)",
  "not-started": "hsl(0, 0%, 28%)",
};

const TrackTracker = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();

  const track = useMemo(() => learningTracks.find((t) => t.id === trackId), [trackId]);

  const { nodes, edges } = useMemo(() => {
    if (!track) return { nodes: [], edges: [] };

    const n: Node[] = [];
    const e: Edge[] = [];

    // Root node
    n.push({
      id: track.id,
      position: { x: 400, y: 0 },
      data: { label: `${track.emoji} ${track.title}` },
      style: {
        background: "hsl(225, 14%, 14%)",
        color: "hsl(210, 20%, 92%)",
        border: "2px solid hsl(142, 60%, 50%)",
        borderRadius: "12px",
        padding: "12px 20px",
        fontSize: "14px",
        fontWeight: 600,
        minWidth: "160px",
        textAlign: "center" as const,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    const topicSpacing = 280;
    const topicStartX = 400 - ((track.topics.length - 1) * topicSpacing) / 2;

    track.topics.forEach((topic, ti) => {
      const topicX = topicStartX + ti * topicSpacing;
      const topicY = 120;

      n.push({
        id: topic.id,
        position: { x: topicX, y: topicY },
        data: { label: topic.title },
        style: {
          background: "hsl(225, 14%, 12%)",
          color: "hsl(210, 20%, 92%)",
          border: `2px solid ${statusBorder[topic.status]}`,
          borderRadius: "10px",
          padding: "10px 16px",
          fontSize: "12px",
          fontWeight: 500,
          minWidth: "140px",
          textAlign: "center" as const,
          boxShadow: `0 0 12px ${statusColor[topic.status]}22`,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      e.push({
        id: `${track.id}-${topic.id}`,
        source: track.id,
        target: topic.id,
        style: { stroke: statusColor[topic.status], strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: statusColor[topic.status] },
      });

      const subSpacing = 180;
      const subStartX = topicX - ((topic.subtopics.length - 1) * subSpacing) / 2;

      topic.subtopics.forEach((sub, si) => {
        const subX = subStartX + si * subSpacing;
        const subY = topicY + 130;

        n.push({
          id: sub.id,
          position: { x: subX, y: subY },
          data: { label: sub.title, subtopicId: sub.id, subtopicTitle: sub.title },
          style: {
            background: statusColor[sub.status] + "18",
            color: "hsl(210, 20%, 88%)",
            border: `1.5px solid ${statusColor[sub.status]}`,
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "11px",
            fontWeight: 400,
            minWidth: "120px",
            textAlign: "center" as const,
            cursor: "pointer",
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        });

        e.push({
          id: `${topic.id}-${sub.id}`,
          source: topic.id,
          target: sub.id,
          style: { stroke: statusColor[sub.status], strokeWidth: 1.5, strokeDasharray: sub.status === "not-started" ? "5,5" : undefined },
          markerEnd: { type: MarkerType.ArrowClosed, color: statusColor[sub.status], width: 12, height: 12 },
        });
      });
    });

    return { nodes: n, edges: e };
  }, [track]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.includes("-") && node.id.split("-").length >= 3) {
        navigate(`/track/${trackId}`);
      }
    },
    [navigate, trackId]
  );

  if (!track) return <Navigate to="/" replace />;

  return (
    <div className="h-screen bg-background bg-grid flex flex-col">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            All Tracks
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-lg">{track.emoji}</span>
          <span className="text-sm font-semibold text-foreground">{track.title}</span>
          <span className="text-muted-foreground">/</span>
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Tracker</span>
        </div>
      </header>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.4}
          maxZoom={1.5}
        >
          <Background color="hsl(225, 12%, 16%)" gap={20} size={1} />
          <Controls
            showInteractive={false}
            style={{ background: "hsl(225, 14%, 12%)", border: "1px solid hsl(225, 12%, 20%)", borderRadius: "8px" }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor.completed }} />
          Completed
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor["in-progress"] }} />
          In Progress
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor["not-started"] }} />
          Not Started
        </div>
      </div>
    </div>
  );
};

export default TrackTracker;
