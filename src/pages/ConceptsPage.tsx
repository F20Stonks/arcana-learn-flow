/**
 * Concepts — everything you've locked in, as a real page.
 *
 * Was the "Knowledge" tab inside HubSidebar's right-hand slide-over. A sheet was the wrong
 * container for it: no URL, no back button, no refresh-into-it, and a fixed narrow column for
 * content that is a searchable list. The three Knowledge destinations are routes now
 * (/concepts, /map, /reviews) and the sheet is gone.
 */
import { useEffect, useState } from "react";
import { GraduationCap, Search, Loader2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type KnownConcept = { name: string; type: string; known_at: string };

const CONCEPT_TYPE_LABEL: Record<string, string> = { notation: "notation", terminology: "term", skill: "skill" };

export default function ConceptsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [knownConcepts, setKnownConcepts] = useState<KnownConcept[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Real known-concept knowledge (permanent, one-way per framework §4), most-recent first.
      const { data: uck } = await supabase
        .from("user_concept_knowledge")
        .select("known_at, concepts(name, type)")
        .eq("user_id", user.id)
        .order("known_at", { ascending: false });
      if (cancelled) return;
      const rows = (uck || []) as unknown as { known_at: string; concepts: { name: string; type: string } | null }[];
      setKnownConcepts(
        rows
          .map((r) => ({ name: r.concepts?.name as string, type: r.concepts?.type || "terminology", known_at: r.known_at }))
          .filter((c) => !!c.name),
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const typeCounts = knownConcepts.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});

  const q = query.trim().toLowerCase();
  const filtered = q ? knownConcepts.filter((c) => c.name.toLowerCase().includes(q)) : knownConcepts;

  return (
    <AppShell>
      <main className="relative mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Concepts
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Atomic concepts — notation, terminology, skills — you've locked in by completing sessions. These are
            global: learn one in any track and it counts everywhere.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center gap-3 py-16">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-[14px] text-muted-foreground">Loading what you know…</p>
          </div>
        ) : (
          <>
            <div className="reveal glass-card mb-6 rounded-2xl p-5" style={{ animationDelay: "60ms" }}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[15px] font-medium text-foreground">Concepts known</span>
                <span className="readout text-3xl font-semibold text-primary">{knownConcepts.length}</span>
              </div>
              <div className="mt-4 flex gap-2">
                {(["notation", "terminology", "skill"] as const).map((t) => (
                  <div key={t} className="flex-1 rounded-lg bg-secondary/60 px-2 py-2 text-center">
                    <div className="readout text-lg font-semibold leading-none text-foreground">{typeCounts[t] || 0}</div>
                    <div className="micro-label mt-1">{CONCEPT_TYPE_LABEL[t]}</div>
                  </div>
                ))}
              </div>
            </div>

            {knownConcepts.length > 0 ? (
              <div className="reveal" style={{ animationDelay: "120ms" }}>
                <div className="glass-card mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search everything you know…"
                    className="flex-1 bg-transparent text-[14px] text-foreground outline-hidden placeholder:text-muted-foreground"
                  />
                </div>

                <h2 className="micro-label mb-2">
                  {q ? `${filtered.length} match${filtered.length === 1 ? "" : "es"}` : "All concepts"}
                </h2>
                {filtered.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {filtered.map((c, i) => (
                      <div key={i} className="glass-card flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] text-foreground">
                        <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="micro-label shrink-0 rounded bg-secondary px-1.5 py-0.5">
                          {CONCEPT_TYPE_LABEL[c.type] || c.type}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-10 text-center text-[14px] text-muted-foreground">No concepts match “{query}”.</p>
                )}
              </div>
            ) : (
              <div className="glass-card reveal rounded-2xl p-10 text-center" style={{ animationDelay: "120ms" }}>
                <p className="text-[14px] text-muted-foreground">
                  Nothing banked yet. Concepts are recorded when you finish a session — complete one and it'll
                  show up here.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}
