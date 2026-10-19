import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
const Dragon3D = lazy(() => import("@/components/Dragon3D"));
export const Route = createFileRoute("/dragon-debug")({ ssr: false, component: Dbg });
function Dbg() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return <div style={{ width: 504, height: 588, background: "#fff", position: "relative" }}>{ok && <Suspense fallback={null}><Dragon3D glow="rgb(255,150,30)" warm="rgb(255,240,200)" /></Suspense>}</div>;
}
