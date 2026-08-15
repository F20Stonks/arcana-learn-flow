import MathTheater from "@/components/workspace/MathTheater";
import { sanitizeScene } from "@/lib/sceneSpec";
const spec = sanitizeScene(JSON.parse(`{"kind":"scene","title":"Vertical Translation: y=f(x)+a","caption":"c","why":"w","flat":true,"camera":[0,0,8],"sliders":[{"key":"a","label":"Shift 'a'","min":-3,"max":3,"step":0.1,"default":0}],"objects":[{"kind":"axes","size":4,"labels":["x","y"],"ticks":true},{"kind":"curve","x":"t","y":"t^2","tMin":-3,"tMax":3,"samples":100,"color":"#94a3b8","width":2,"label":"y=x^2"},{"kind":"curve","x":"t","y":"t^2+a","tMin":-3,"tMax":3,"samples":100,"color":"#fbbf24","width":2.5},{"kind":"text","at":[-2.5,0.2,0],"content":"y=x^2","latex":true,"color":"#94a3b8","size":0.28},{"kind":"text","at":[-2.5,"(-2.5)^2+a+0.2",0],"content":"y=x^2+a","latex":true,"color":"#fbbf24","size":0.28},{"kind":"text","at":[2.8,3.5,0],"content":"a=\${a}","latex":true,"color":"#e2e8f0","size":0.3}]}`) as any);
export default function TmpScene() {
  return <div className="h-screen w-screen"><MathTheater payload={spec as any} /></div>;
}
