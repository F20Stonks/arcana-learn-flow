/** Canvas viewport maths, kept out of the component file so it can be shared without breaking
 *  React Fast Refresh (a module that exports both components and helpers loses hot reload). */

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2.5;

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
