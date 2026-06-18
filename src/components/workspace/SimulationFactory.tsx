import type { SimulationPayload } from "@/lib/simulationPayload";
import VectorFieldEngine from "./engines/VectorFieldEngine";
import ApproximatorEngine from "./engines/ApproximatorEngine";
import TopologyWrapEngine from "./engines/TopologyWrapEngine";
import LinearTransformEngine from "./engines/LinearTransformEngine";

interface Props {
  payload: SimulationPayload;
  params: Record<string, number>;
}

/**
 * Polymorphic router. Mounts the engine matching `payload.archetype`.
 * Every engine accepts (config, params) and renders to a full-bleed canvas.
 * No topic-specific branching lives here.
 */
export default function SimulationFactory({ payload, params }: Props) {
  switch (payload.archetype) {
    case "vector_field":
      return <VectorFieldEngine config={payload.config} params={params} />;
    case "approximator":
      return <ApproximatorEngine config={payload.config} params={params} />;
    case "topology_wrap":
      return <TopologyWrapEngine config={payload.config} params={params} />;
    case "linear_transform":
      return <LinearTransformEngine config={payload.config} params={params} />;
    default:
      return null;
  }
}