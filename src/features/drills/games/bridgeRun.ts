import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

const ASK_TYPES = ["euler_circuit", "euler_path"] as const;

function keyOf(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Spanning tree first (guarantees the graph is connected — Eulerian questions on a disconnected
 *  graph are a degenerate, uninteresting case), then a handful of random extra edges for variety. */
function generateGraph(n: number, extraEdges: number, rng: () => number): [number, number][] {
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 1; i < n; i++) {
    const j = Math.floor(rng() * i);
    edges.push([i, j]);
    seen.add(keyOf(i, j));
  }
  let added = 0;
  let attempts = 0;
  while (added < extraEdges && attempts < 40) {
    attempts++;
    const a = Math.floor(rng() * n);
    const b = Math.floor(rng() * n);
    if (a === b) continue;
    const k = keyOf(a, b);
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push([a, b]);
    added++;
  }
  return edges;
}

export const bridgeRun: DrillDefinition = {
  key: "bridge-run",
  name: "Bridge Run",
  tagline: "Eulerian paths, on the spot.",
  domain: "topology",
  defaultDurationS: 75,
  inputKind: "binary",
  modes: [
    { id: "classic", label: "Classic sprint", description: "75 seconds calling Eulerian circuits and paths on random graphs." },
    { id: "adaptive", label: "Adaptive staircase", description: "Starts with small graphs, adds vertices and edges on a streak." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights toward whichever you get wrong more — circuit calls or path calls." },
  ],
  binaryOptions: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ],
  rules:
    "A random connected graph appears. An Eulerian circuit uses every edge exactly once and returns to its start — a graph has one exactly when every vertex has even degree. An Eulerian path uses every edge exactly once but may start and end at different vertices — a graph has one when 0 or exactly 2 vertices have odd degree. Answer Yes or No for whichever's asked.",
  generate: ({ level, rng, biasTags }) => {
    let askType: (typeof ASK_TYPES)[number] = pick([...ASK_TYPES], rng);
    if (biasTags?.length) {
      const eligible = ASK_TYPES.filter((t) => biasTags.includes(t));
      if (eligible.length && rng() < 0.7) askType = pick([...eligible], rng);
    }

    const n = 4 + Math.min(2, Math.floor(level / 2));
    const extraMax = 2 + Math.min(3, level);
    const extraEdges = Math.floor(rng() * (extraMax + 1));
    const edges = generateGraph(n, extraEdges, rng);

    const degree = new Array(n).fill(0);
    for (const [a, b] of edges) {
      degree[a]++;
      degree[b]++;
    }
    const oddCount = degree.filter((d) => d % 2 === 1).length;
    const hasCircuit = oddCount === 0;
    const hasPath = oddCount === 0 || oddCount === 2;

    const answerYes = askType === "euler_circuit" ? hasCircuit : hasPath;
    const prompt =
      askType === "euler_circuit"
        ? "Does this graph have an Eulerian circuit — a closed walk using every edge exactly once?"
        : "Does this graph have an Eulerian path — a walk using every edge exactly once?";

    return {
      id: `${Date.now()}-${Math.floor(rng() * 1e6)}`,
      tag: askType,
      prompt,
      answer: answerYes ? "yes" : "no",
      visual: { kind: "graph", vertexCount: n, edges },
    };
  },
};
