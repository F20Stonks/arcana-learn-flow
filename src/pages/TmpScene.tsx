import MathTheater from "@/components/workspace/MathTheater";
import Scene3D from "@/components/workspace/Scene3D";
import { sanitizeScene } from "@/lib/sceneSpec";
import { VIZ_THEMES } from "@/lib/vizThemes";
const spec = sanitizeScene({ kind: "scene", title: "T", flat: true, camera: [0, 0, 8], objects: [{ kind: "axes", size: 4, labels: ["x", "y"] }] } as never) as never;
export default function TmpScene() {
  console.log("TMP spec", JSON.stringify(spec));
  return (
    <div className="flex h-screen w-screen">
      <div className="h-full w-1/2 border-r border-white/20"><Scene3D spec={spec} params={{}} onParam={() => {}} theme={VIZ_THEMES[0]} /></div>
      <div className="h-full w-1/2"><MathTheater payload={spec} /></div>
    </div>
  );
}
