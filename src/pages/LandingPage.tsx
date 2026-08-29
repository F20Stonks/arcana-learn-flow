import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { Sigma, Zap } from "lucide-react";
import Reveal from "@/components/landing/Reveal";
import VectorField from "@/components/landing/VectorField";
import TrackDemo from "@/components/landing/TrackDemo";
import SessionChat from "@/components/landing/SessionChat";
import SceneDemo from "@/components/landing/SceneDemo";
import "@/components/landing/landing.css";

/**
 * Editorial landing ("Direction D"). One job: visitor → user.
 *
 * The page demonstrates rather than asserts — the hero shows a goal becoming
 * a complete track (real engine output), the session excerpt shows the
 * teaching voice. Division of labour: the hero demo owns coverage; the
 * failure-mode cards own gaps, false mastery, and forgetting; the
 * capabilities grid is the scannable "what does this do" for visitors who
 * want the list, not the narrative.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const FAILURE_MODES = [
  {
    no: "“I was missing something from two chapters ago.”",
    yes: (
      <>
        A <b>readiness check</b> before every session. Gaps get built first.
      </>
    ),
  },
  {
    no: "“I memorised it — then it fell apart in the exam.”",
    yes: (
      <>
        Nothing counts as learned until you've <b>explained the why</b>,
        unaided, and used it on a fresh problem.
      </>
    ),
  },
  {
    no: "“I knew it in October. By the exam it was gone.”",
    yes: (
      <>
        Every idea returns on a <b>schedule timed to memory</b> — automatically,
        before it fades.
      </>
    ),
  },
];

const CAPABILITIES = [
  {
    index: "01 — Visualize",
    title: "See it, don't just read it",
    body: (
      <>
        Live, interactive scenes render <b>on demand</b> — rotate a field,
        watch a proof unfold, drag a parameter and see the curve move.
        Generated for the exact idea you're on. Try one below.
      </>
    ),
  },
  {
    index: "02 — Adapt",
    title: "Ask anything, mid-explanation",
    body: (
      <>
        Stuck? Cortexed <b>rebuilds the explanation</b> around exactly where
        you are — a different angle, more context, a simpler case — instead
        of repeating itself louder.
      </>
    ),
  },
  {
    index: "03 — Sequence",
    title: "Never taught out of order",
    body: (
      <>
        Your entire path is <b>generated from what you actually know</b>.
        Nothing assumed you haven't been taught, nothing repeated you've
        already mastered.
      </>
    ),
  },
  {
    index: "04 — Automate",
    title: "Runs without you",
    body: (
      <>
        Active recall is scheduled and delivered automatically, timed to
        memory. You never decide what to review, or when —{" "}
        <b>log in, engage, leave</b>.
      </>
    ),
  },
];

function HeroReveal({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="ldg">
        <VectorField className="field" />

        <div className="page">
          <nav>
            <Link to="/" className="brand">
              Cortexed<i>.</i>
            </Link>
            <div className="nav-right">
              <Link to="/pricing" className="nav-signin">
                Pricing
              </Link>
              <Link to="/auth" className="nav-signin">
                Sign in
              </Link>
              <Link to="/auth?mode=signup" className="nav-cta">
                Start your track
              </Link>
            </div>
          </nav>

          {/* HERO — the live vector field flows beneath */}
          <header className="hero">
            <div>
              <HeroReveal delay={0}>
                <div className="eyebrow">Maths &amp; Physics · School to degree</div>
              </HeroReveal>
              <HeroReveal delay={0.09}>
                <h1>
                  Understand any maths or physics — <i>from first principles.</i>
                </h1>
              </HeroReveal>
              <HeroReveal delay={0.18}>
                <p className="lede">
                  Name the goal. Cortexed builds the <b>complete path</b> —{" "}
                  <b>one idea per session</b>, readiness checked before each,
                  every result taught from the <b>why</b>.
                </p>
              </HeroReveal>
              <HeroReveal delay={0.27}>
                <div className="cta-row">
                  <Link to="/auth?mode=signup" className="cta">
                    Start your track →
                  </Link>
                  <span className="cta-sub">Free · ~30 seconds</span>
                </div>
              </HeroReveal>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
            >
              <TrackDemo />
            </motion.div>
          </header>

          {/* WHY IT WORKS */}
          <section id="why">
            <Reveal>
              <div className="sec-eyebrow">Why it works</div>
              <h2>Every way learning fails — engineered out.</h2>
            </Reveal>
            <div className="modes">
              {FAILURE_MODES.map((m, i) => (
                <Reveal key={i} delay={0.09 * (i + 1)}>
                  <div className="mode">
                    <div className="no">{m.no}</div>
                    <div className="yes">{m.yes}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* CAPABILITIES */}
          <section id="what">
            <Reveal>
              <div className="sec-eyebrow">What's actually happening</div>
              <h2>One tutor, doing four things at once.</h2>
            </Reveal>
            <div className="capabilities">
              {CAPABILITIES.map((c, i) => (
                <Reveal key={c.title} delay={0.07 * (i + 1)}>
                  <div className="capability">
                    <div className="cap-index">{c.index}</div>
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* INSIDE A SESSION */}
          <section className="teach">
            <Reveal>
              <div className="sec-eyebrow">Inside a session</div>
              <h2>It doesn't tell you the rule. It makes it inevitable.</h2>
              <p className="teach-lede">
                Predict → explain → apply. One idea at a time.
              </p>
            </Reveal>
            <SessionChat />
          </section>

          {/* THE SCENE ENGINE — the conversation above, made touchable */}
          <section className="scene" id="scene">
            <Reveal>
              <div className="sec-eyebrow">The scene engine</div>
              <h2>Anything it can teach, it can show you.</h2>
              <p className="teach-lede">
                No video library — an engine. When seeing it is what makes it
                click, Cortexed builds a live, interactive scene for the exact
                idea in front of you — not found, <b>built</b>. This is the
                skater from the conversation above, as physics.{" "}
                <b>Pull the mass inward.</b>
              </p>
            </Reveal>
            <Reveal delay={0.12}>
              <SceneDemo />
            </Reveal>
          </section>

          {/* FREE TOOLS — Integral Arena and the drill arcade are both live for every signup,
              no waitlist or approval step, unlike the rest of the app. */}
          <section className="tools" id="tools">
            <Reveal>
              <div className="sec-eyebrow">Try it free, right now</div>
              <h2>Two tools live the moment you sign up.</h2>
              <p className="teach-lede">
                No waitlist, no approval step — Integral Arena and the drill arcade are
                open to every account from the first minute.
              </p>
            </Reveal>
            <div className="tool-grid">
              <Reveal delay={0.08}>
                <div className="tool-card">
                  <div className="tool-icon">
                    <Sigma className="h-5 w-5" />
                  </div>
                  <h3>Integral Arena</h3>
                  <p>
                    A free integration-bee trainer. A new <b>daily integral</b> for
                    everyone, technique-by-technique training rooms with full worked
                    lessons, and <b>788 problems</b> sourced from real competitions —
                    MIT, HMMT, and more.
                  </p>
                  <ul className="tool-stats">
                    <li>788 sourced problems</li>
                    <li>21 named techniques</li>
                    <li>Daily streak &amp; leaderboard</li>
                  </ul>
                  <Link to="/auth?mode=signup" className="tool-cta">
                    Try Integral Arena →
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={0.16}>
                <div className="tool-card">
                  <div className="tool-icon">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3>Zetamac++ &amp; the drill arcade</h3>
                  <p>
                    A souped-up Zetamac — mixed arithmetic sprints with{" "}
                    <b>adaptive difficulty</b> and weak-spot targeting — plus eight more
                    timed drills across number theory, algebra, and topology.
                  </p>
                  <ul className="tool-stats">
                    <li>9 drills</li>
                    <li>Classic, adaptive &amp; weak-spot modes</li>
                    <li>Global leaderboard</li>
                  </ul>
                  <Link to="/auth?mode=signup" className="tool-cta">
                    Try the drills →
                  </Link>
                </div>
              </Reveal>
            </div>
          </section>

          {/* FINAL */}
          <section className="final" id="start">
            <Reveal>
              <h2>Name the goal. The path builds itself.</h2>
              <Link to="/auth?mode=signup" className="cta">
                Start your track →
              </Link>
              <span className="cta-sub">
                Free · maths &amp; physics · school to degree
              </span>
            </Reveal>
          </section>

          <footer>
            <div>Cortexed — an instrument for mathematical &amp; physical understanding.</div>
            <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>
              © {new Date().getFullYear()} Pranit Singh Chhabra ·{" "}
              <Link to="/pricing">Pricing</Link> ·{" "}
              <Link to="/terms">Terms</Link> ·{" "}
              <Link to="/privacy">Privacy</Link> ·{" "}
              <Link to="/refund">Refunds</Link>
            </div>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}
