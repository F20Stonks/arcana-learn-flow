import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Boxes, GitBranch, RefreshCw, ArrowRight } from "lucide-react";
import HeroVisual from "@/components/landing/HeroVisual";
import Reveal from "@/components/landing/Reveal";

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Tutoring that adapts mid-conversation",
    body: "Ask anything. Jarvis rebuilds the explanation around exactly where you're stuck — more context, a different angle, a simpler breakdown — instead of just repeating itself louder.",
  },
  {
    icon: Boxes,
    title: "Visualize it until it's obvious",
    body: "Live, interactive math visualizations generated on demand — because some things only click once you can actually see them move.",
  },
  {
    icon: GitBranch,
    title: "Personalized, prerequisite-aware sequencing",
    body: "No buffet. Your path is built from what you actually know, so you're never taught something you're not ready for — or bored re-covering what you've already mastered.",
  },
  {
    icon: RefreshCw,
    title: "Active recall, fully automated",
    body: "The spaced-repetition schedule that actually works, run silently in the background. You never have to decide what to review, or when.",
  },
];

const PROBLEMS = [
  "Endless content, zero personalization — you're on your own to figure out what you actually need next.",
  "Generic explanations that assume you already have the context to understand them.",
  "No one manages the boring part — what to review, and when, before you forget it.",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <span className="text-lg font-bold tracking-tight">Jarvis</span>
        <Link
          to="/auth"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 -z-0">
          <HeroVisual />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/10 to-transparent" />
        </div>

        <div className="relative z-[1] px-6 md:px-12 pt-16 pb-40 md:pt-24 md:pb-56 max-w-3xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]"
          >
            Understanding isn't optional.
            <br />
            It's the only thing that's actually tested.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-lg text-muted-foreground max-w-xl"
          >
            Jarvis breaks every concept down until it's impossible not to understand it —
            then runs the entire optimization loop for you: sequencing, prerequisites, and
            active recall. You show up. It handles the rest.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Link
              to="/auth?mode=signup"
              className="group inline-flex items-center gap-2 h-12 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all"
            >
              Start learning free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/auth"
              className="h-12 px-6 rounded-lg border border-border flex items-center text-sm font-medium text-foreground/80 hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Sign in
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Problem */}
      <section className="px-6 md:px-12 py-24 md:py-32">
        <div className="max-w-3xl">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Most learning tools give up before you do.
            </h2>
          </Reveal>
          <div className="mt-10 space-y-6">
            {PROBLEMS.map((p, i) => (
              <Reveal key={p} delay={0.08 * (i + 1)}>
                <div className="flex gap-4 items-start">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                  <p className="text-lg text-muted-foreground">{p}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Mechanism */}
      <section className="px-6 md:px-12 py-24 md:py-32 bg-card/40 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight max-w-2xl">
              Built to make misunderstanding impossible.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
              Every explanation adapts in real time — broken down further, given a new
              example, or visualized until it clicks. Nothing moves on until it's actually
              understood.
            </p>
          </Reveal>

          <div className="mt-14 grid sm:grid-cols-2 gap-6">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={0.06 * i}>
                <div className="h-full rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Automation statement */}
      <section className="px-6 md:px-12 py-28 md:py-40">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <p className="text-sm uppercase tracking-[0.2em] text-primary font-medium">
              Zero management required
            </p>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">
              The nutritionist for your brain.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
              You don't need to understand the neuroscience of memory or design your own
              review schedule — that's the job it does for you. Log in, engage, leave. The
              optimization runs whether you think about it or not.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 md:px-12 py-24 md:py-32 border-t border-border">
        <Reveal className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Stop managing your own education.
          </h2>
          <Link
            to="/auth?mode=signup"
            className="group mt-8 inline-flex items-center gap-2 h-12 px-7 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all"
          >
            Start learning free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </section>

      <footer className="px-6 md:px-12 py-10 text-sm text-muted-foreground border-t border-border">
        Jarvis
      </footer>
    </div>
  );
}
