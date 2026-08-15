import MathTheater from "@/components/workspace/MathTheater";
import { sanitizeScene } from "@/lib/sceneSpec";
export default function TmpScene() {
  const raw = new URLSearchParams(location.search).get("s");
  const spec = sanitizeScene(JSON.parse(raw ? atob(raw) : '{"kind":"scene","title":"T","flat":true,"camera":[0,0,8],"objects":[{"kind":"axes","size":4,"labels":["x","y"]}]}') as never);
  return <div className="h-screen w-screen"><MathTheater payload={spec as never} /></div>;
}
