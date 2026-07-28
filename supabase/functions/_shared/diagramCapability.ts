/**
 * Shared prompt fragment: gives question-attack and generate-paper the option
 * to attach a diagram to a question stem or to individual MCQ options, using
 * the exact scene-spec JSON format the app's existing Scene3D renderer (the
 * "Math Theater" pipeline) already knows how to draw — see
 * src/lib/sceneSpec.ts and the Scene Director prompt in src/lib/sceneDirector.ts
 * for the full primitive set this is a deliberately-trimmed subset of.
 *
 * Kept purely ADDITIVE: this is appended after each function's own
 * pedagogical prompt, not woven into it, so tuning the question-writing
 * wording elsewhere never has to route through this block and vice versa.
 */
export const DIAGRAM_CAPABILITY = `DIAGRAMS (optional, use sparingly): most questions need no diagram — only attach one when a picture is genuinely required (a graph-matching MCQ where the options ARE graphs/shapes, not text) or meaningfully helps (e.g. "the diagram below shows...", a geometric figure, a plotted function the student must read values off).

To attach a diagram to a question's STEM, add a top-level "scene" field to that question object, shaped exactly like this (the app's existing scene format):
{"kind":"scene","title":"short label","flat":true,"camera":[0,0,8],"objects":[ ...primitives... ]}

To make one or more MCQ OPTIONS themselves be diagrams (e.g. "which graph shows f(x)=..."), keep "options" as short plain-text labels so answer-matching keeps working exactly as before (e.g. ["Graph A","Graph B","Graph C","Graph D"], with "correct_answer" still equal to one of those strings), and add a parallel top-level "option_scenes" array — SAME LENGTH AND ORDER as "options" — where each entry is either null (that option has no diagram) or a scene object shaped as above for that option's graph/shape.

Available primitives (each is one entry in "objects"; numeric fields may be plain numbers or mathjs expression strings):
- axes: {"kind":"axes","size":4,"labels":["x","y"]}
- grid: {"kind":"grid","plane":"xy","size":5,"divisions":10}
- curve: {"kind":"curve","x":"t","y":"sin(t)","tMin":-4,"tMax":4,"color":"#38bdf8"} — parametric, t sweeps tMin..tMax
- point: {"kind":"point","at":[1,2,0],"label":"A","color":"#fbbf24"}
- segment: {"kind":"segment","from":[0,0],"to":[1,1],"label":"AB"}
- arc: {"kind":"arc","center":[0,0],"radius":2,"from":0,"to":"pi/2"}
- angleMark: {"kind":"angleMark","at":[..],"from":[..],"to":[..],"label":"\\\\theta"}
- polygon: {"kind":"polygon","vertices":[[0,0],[1,0],[0,1]]}
- regionFill: {"kind":"regionFill","yTop":"x^2","tMin":0,"tMax":2} — shaded area under a curve
- bars: {"kind":"bars","count":5,"x":"i","height":"i^2"} — histogram/bar chart
- text: {"kind":"text","at":[0,-1,0],"content":"y=x^2","latex":true}

Rules for these diagrams: always set "flat":true (these are static 2D exam diagrams, not interactive 3D teaching scenes) unless a genuinely 3D figure is required. Never include "sliders", "steps", "drag", or "time" — a question's diagram is a fixed picture, not a manipulable teaching visualization. Keep it to 3-10 primitives: enough to be an honest, correctly-labelled diagram, no more.`;
