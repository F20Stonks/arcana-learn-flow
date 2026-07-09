/**
 * Visualization Engine — Type definitions
 * 
 * Pre-rendered component library that AI can assemble with data props.
 * Each visualization type has a strict interface so the AI can generate
 * the right data structure via tool calls.
 */

export interface Point2D {
  x: number;
  y: number;
  label?: string;
  color?: string;
}

export interface ComplexNumber {
  real: number;
  imaginary: number;
  label?: string;
  color?: string;
}

export interface Vector2D {
  origin: Point2D;
  direction: Point2D;
  label?: string;
  color?: string;
}

export interface GraphFunction {
  /** Math expression string, e.g. "x^2 - 3x + 2" */
  expression: string;
  color?: string;
  label?: string;
  domain?: [number, number];
}

export interface VisualizationProps {
  width?: number;
  height?: number;
  title?: string;
  className?: string;
}

// --- Component-specific props ---

export interface ComplexPlaneProps extends VisualizationProps {
  points: ComplexNumber[];
  vectors?: Vector2D[];
  showGrid?: boolean;
  range?: [number, number]; // symmetric range on both axes
}

export interface NumberLineProps extends VisualizationProps {
  points: { value: number; label?: string; color?: string }[];
  range: [number, number];
  intervals?: { start: number; end: number; color?: string; label?: string }[];
}

export interface GraphPlotProps extends VisualizationProps {
  functions: GraphFunction[];
  xRange?: [number, number];
  yRange?: [number, number];
  showGrid?: boolean;
  points?: Point2D[];
}

export interface VectorDiagramProps extends VisualizationProps {
  vectors: Vector2D[];
  showGrid?: boolean;
  range?: [number, number];
}

export interface UnitCircleProps extends VisualizationProps {
  angle: number; // in radians
  showSin?: boolean;
  showCos?: boolean;
  showTan?: boolean;
}

export interface BarChartProps extends VisualizationProps {
  data: { label: string; value: number; color?: string }[];
  yLabel?: string;
}

// Registry of all visualization types for AI tool calling
export type VisualizationType =
  | "complex-plane"
  | "number-line"
  | "graph-plot"
  | "vector-diagram"
  | "unit-circle"
  | "bar-chart";

export interface VisualizationConfig {
  type: VisualizationType;
  props: Record<string, any>;
}
