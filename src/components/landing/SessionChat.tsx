import { motion } from "framer-motion";

/**
 * A real teaching beat, verbatim in the product's voice: connect to what's
 * known → predict → explain the why → apply to something unseen.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

function Bubble({
  side,
  delay,
  children,
}: {
  side: "ai" | "me";
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={`bubble ${side}`}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export default function SessionChat() {
  return (
    <div className="chat" aria-label="Excerpt of a Jarvis teaching session">
      <Bubble side="ai" delay={0.1}>
        You know momentum is conserved when no external force acts. Angular
        momentum works the <span className="why">same way</span> — so: an ice
        skater pulls her arms in. <b>Predict</b> her spin, and say{" "}
        <span className="why">why</span>.
      </Bubble>
      <Bubble side="me" delay={0.45}>
        Faster — pulling mass inward shrinks I, so ω must rise to keep L
        constant.
      </Bubble>
      <Bubble side="ai" delay={0.8}>
        Exactly — L = Iω is fixed, so shrinking I{" "}
        <span className="why">forces</span> ω up. Now one you haven't seen: a
        neutron star collapses to 1/100th of its radius…
      </Bubble>
      <motion.div
        className="chat-cap"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, delay: 1.15 }}
      >
        predict → explain → apply
      </motion.div>
    </div>
  );
}
