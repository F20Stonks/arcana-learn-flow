/**
 * Map — the concept dependency graph, as a real page.
 *
 * Was the "Map" tab inside HubSidebar's slide-over, where ConceptGraph rendered into a ~320px
 * column. A graph is the content most punished by a narrow fixed panel, so it gets the full
 * canvas here. ConceptGraph loads its own data, so this page is just the frame.
 */
import AppShell from "@/components/AppShell";
import ConceptGraph from "@/components/ConceptGraph";
import SafeBoundary from "@/components/SafeBoundary";

export default function MapPage() {
  return (
    <AppShell>
      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Map
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            How your concepts connect — what you know, what it unlocks, and the prerequisites you're still
            missing.
          </p>
        </header>

        <div className="reveal glass-card overflow-hidden rounded-2xl p-4 sm:p-6" style={{ animationDelay: "60ms" }}>
          <SafeBoundary label="Concept map">
            <ConceptGraph />
          </SafeBoundary>
        </div>
      </main>
    </AppShell>
  );
}
