import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { lookFromRow } from "@/lib/avatar";
import type { Guest } from "@/components/avatar/CeremonyScene";

const CeremonyScene = lazy(() => import("@/components/avatar/CeremonyScene"));

// Temporary visual check of the gala hall (removed after review).
export const Route = createFileRoute("/hall-preview")({ ssr: false, component: Preview });

function Preview() {
  const view = (new URLSearchParams(window.location.search).get("view") ?? "hall") as "hall" | "stage";
  const [audience] = useState<Guest[]>(() => Array.from({ length: 22 }, (_, i) => ({ id: `g${i}`, name: `Joueur ${i + 1}`, look: lookFromRow(undefined), trophies: 0 })));
  return (
    <div style={{ height: "100vh" }}>
      <Suspense fallback={null}>
        <CeremonyScene audience={audience} host={{ id: "h", name: "Admin", look: lookFromRow(undefined), trophies: 0 }} winner={null} revealAt={null} view={view} myId="g3" trophy="ballon" awarded={[]} />
      </Suspense>
    </div>
  );
}
