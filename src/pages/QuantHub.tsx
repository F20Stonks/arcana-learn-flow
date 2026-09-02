/**
 * UK Quant — a dedicated, lesson-first curriculum page (src/features/quant). Deliberately
 * separate from DrillsHub (general-audience Drills catalog) and IntegralsHub (Integral Arena):
 * this is a personal, curated ladder through A-level → Further Maths → STEP → quant-specific
 * technique, read-only reusing the Drills practice engine via each topic's focus-tagged
 * practice link rather than duplicating it.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import AppShell from "@/components/AppShell";
import QuantLessonBody from "@/features/quant/components/QuantLessonBody";
import ExternalResourceChecklist from "@/features/quant/components/ExternalResourceChecklist";
import { QUANT_TOPICS, RUNG_LABEL, RUNG_ORDER } from "@/features/quant/curriculum";
import { EXTERNAL_RESOURCES } from "@/features/quant/externalResources";

export default function QuantHub() {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <AppShell>
      <main className="relative mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            UK Quant
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            A-level → Further Maths → STEP → quant-specific technique. Read the recognition cue and the
            recipe first, then drill exactly that skill — nothing here is invented busywork, every recipe
            is the thing a formula sheet doesn't give you.
          </p>
        </header>

        <div className="reveal flex flex-col gap-8" style={{ animationDelay: "60ms" }}>
          {RUNG_ORDER.map((rung) => {
            const topics = QUANT_TOPICS.filter((t) => t.rung === rung);
            if (!topics.length) return null;
            return (
              <section key={rung}>
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {RUNG_LABEL[rung]}
                </h2>
                <div className="flex flex-col gap-4">
                  {topics.map((topic) => {
                    const isOpen = !!open[topic.id];
                    return (
                      <div key={topic.id} className="glass-card rounded-2xl p-5">
                        <button
                          onClick={() => setOpen((o) => ({ ...o, [topic.id]: !o[topic.id] }))}
                          className="flex w-full items-start justify-between gap-3 text-left"
                          aria-expanded={isOpen}
                        >
                          <div>
                            <h3 className="text-[17px] font-semibold text-foreground">{topic.title}</h3>
                            <p className="text-[13.5px] text-muted-foreground">{topic.tagline}</p>
                          </div>
                          {isOpen ? (
                            <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                          )}
                        </button>

                        {isOpen && (
                          <div className="mt-4 border-t border-border/60 pt-4">
                            <QuantLessonBody topic={topic} />

                            <div className="mt-5 flex flex-wrap gap-2">
                              {topic.practice.map((p) => (
                                <Link
                                  key={p.label}
                                  to={`/drills/${p.drillKey}?mode=classic${p.focusTag ? `&focus=${p.focusTag}` : ""}`}
                                  className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                >
                                  {p.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <section className="reveal mt-10" style={{ animationDelay: "80ms" }}>
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            External resources
          </h2>
          <p className="mb-4 text-[13.5px] text-muted-foreground">
            Reading/practice tracked from outside sources — the actual problems and solutions live at the
            link, this just checks off what you've been through.
          </p>
          <div className="flex flex-col gap-4">
            {EXTERNAL_RESOURCES.map((group) => (
              <ExternalResourceChecklist key={group.id} group={group} />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
