import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Hero demonstration: a goal types itself, the full path materialises.
 *
 * Cycles three goals spanning the product's real range (school → degree →
 * elite exam) so a visitor sees their own kind of goal handled, not just one.
 * Content is scripted from real engine output — the JEE figures (40 topics ·
 * 366 sessions) are the verified numbers from the multi-pass generator, and
 * session titles follow its one-idea-per-session grain rule.
 */

interface DemoSession {
  title: string;
  mins: number;
}
interface DemoTopic {
  name: string;
  count: number;
  sessions: DemoSession[];
}
interface DemoGoal {
  goal: string;
  meta: string;
  topics: number;
  total: number;
  list: DemoTopic[];
}

const GOALS: DemoGoal[] = [
  {
    goal: "I want a top rank in JEE Advanced",
    meta: "Full syllabus mapped",
    topics: 40,
    total: 366,
    list: [
      {
        name: "Rotational Mechanics",
        count: 10,
        sessions: [
          { title: "Torque as the turning effect of a force", mins: 25 },
          { title: "Moment of inertia of a point mass", mins: 20 },
          { title: "Angular momentum & when it's conserved", mins: 25 },
        ],
      },
      {
        name: "Chemical & Ionic Equilibrium",
        count: 10,
        sessions: [
          { title: "Equilibrium as two rates balancing", mins: 20 },
          { title: "Kc — turning equilibrium into a number", mins: 25 },
          { title: "Le Chatelier: predicting the shift", mins: 25 },
        ],
      },
      {
        name: "Complex Numbers & Quadratics",
        count: 10,
        sessions: [
          { title: "Why √−1 is allowed", mins: 20 },
          { title: "The Argand plane: numbers as points", mins: 20 },
          { title: "Modulus–argument form", mins: 25 },
        ],
      },
      {
        name: "Limits & Differentiability",
        count: 8,
        sessions: [
          { title: "What a limit actually claims", mins: 25 },
          { title: "Continuity vs differentiability", mins: 25 },
          { title: "Where derivatives fail to exist", mins: 20 },
        ],
      },
    ],
  },
  {
    goal: "Get me through university electromagnetism",
    meta: "Complete course mapped",
    topics: 11,
    total: 89,
    list: [
      {
        name: "Electrostatics",
        count: 9,
        sessions: [
          { title: "The field concept, made precise", mins: 25 },
          { title: "Gauss's law in integral form", mins: 30 },
          { title: "Why field lines never cross", mins: 20 },
        ],
      },
      {
        name: "Magnetostatics",
        count: 8,
        sessions: [
          { title: "The Biot–Savart law", mins: 25 },
          { title: "Ampère's law — and when to trust it", mins: 25 },
          { title: "The Lorentz force", mins: 20 },
        ],
      },
      {
        name: "Electromagnetic Induction",
        count: 7,
        sessions: [
          { title: "Faraday's law: flux and EMF", mins: 25 },
          { title: "Lenz's law from energy conservation", mins: 20 },
          { title: "Self-inductance", mins: 25 },
        ],
      },
      {
        name: "Maxwell's Equations & Waves",
        count: 9,
        sessions: [
          { title: "Displacement current: fixing Ampère", mins: 25 },
          { title: "Light falls out of the equations", mins: 30 },
          { title: "Energy flow: the Poynting vector", mins: 25 },
        ],
      },
    ],
  },
  {
    goal: "I need a grade 9 in GCSE maths",
    meta: "Full syllabus mapped",
    topics: 15,
    total: 112,
    list: [
      {
        name: "Algebra",
        count: 12,
        sessions: [
          { title: "Solving linear equations", mins: 20 },
          { title: "Straight-line graphs: y = mx + c", mins: 20 },
          { title: "Factorising quadratics", mins: 25 },
        ],
      },
      {
        name: "Geometry & Trigonometry",
        count: 10,
        sessions: [
          { title: "Pythagoras — and why it's true", mins: 20 },
          { title: "Trig ratios without memorising", mins: 25 },
          { title: "Circle theorems from one idea", mins: 25 },
        ],
      },
      {
        name: "Ratio & Proportion",
        count: 8,
        sessions: [
          { title: "Ratio as scaling", mins: 20 },
          { title: "Direct & inverse proportion", mins: 20 },
          { title: "Reverse percentages", mins: 20 },
        ],
      },
      {
        name: "Probability & Statistics",
        count: 9,
        sessions: [
          { title: "Probability as counting outcomes", mins: 20 },
          { title: "Tree diagrams", mins: 20 },
          { title: "Averages that don't lie", mins: 20 },
        ],
      },
    ],
  },
];

const TYPE_MS = 34;
const OPEN_HOLD_MS = 2600;

function useCountUp(target: number, run: boolean, duration: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) {
      setValue(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return value;
}

export default function TrackDemo() {
  const reduced = useReducedMotion();
  const [goalIdx, setGoalIdx] = useState(0);
  const [typedLen, setTypedLen] = useState(0);
  const [mapped, setMapped] = useState(false);
  const [shown, setShown] = useState(0);
  const [openIdx, setOpenIdx] = useState(-1);
  const [leaving, setLeaving] = useState(false);
  const aliveRef = useRef(true);

  const goal = GOALS[goalIdx];
  const topicCount = useCountUp(goal.topics, mapped, 500);
  const sessionCount = useCountUp(goal.total, mapped, 750);

  useEffect(() => {
    if (reduced) {
      // Static tableau: first goal fully materialised, first topic open.
      setTypedLen(GOALS[0].goal.length);
      setMapped(true);
      setShown(GOALS[0].list.length);
      setOpenIdx(0);
      return;
    }

    aliveRef.current = true;
    const alive = () => aliveRef.current;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    (async () => {
      let g = 0;
      await sleep(600);
      while (alive()) {
        const cur = GOALS[g];
        for (let c = 1; c <= cur.goal.length; c++) {
          if (!alive()) return;
          setTypedLen(c);
          await sleep(TYPE_MS);
        }
        await sleep(380);
        if (!alive()) return;
        setMapped(true);
        await sleep(760);
        for (let i = 1; i <= cur.list.length; i++) {
          if (!alive()) return;
          setShown(i);
          await sleep(120);
        }
        await sleep(320);
        for (let o = 0; o < cur.list.length; o++) {
          if (!alive()) return;
          setOpenIdx(o);
          await sleep(OPEN_HOLD_MS);
        }
        if (!alive()) return;
        setOpenIdx(-1);
        await sleep(420);
        if (!alive()) return;
        setLeaving(true);
        await sleep(300);
        if (!alive()) return;
        g = (g + 1) % GOALS.length;
        setGoalIdx(g);
        setTypedLen(0);
        setMapped(false);
        setShown(0);
        setLeaving(false);
        await sleep(260);
      }
    })();

    return () => {
      aliveRef.current = false;
    };
  }, [reduced]);

  return (
    <div className="demo" aria-label="Demonstration: a goal becoming a complete learning track">
      <div className={"demo-inner" + (leaving ? " leaving" : "")}>
        <div className="demo-goal">
          <span className="prompt">›</span>
          <span>
            {goal.goal.slice(0, typedLen)}
            <span className="caret" />
          </span>
        </div>
        <div className="demo-body">
          <div className={"demo-meta" + (mapped ? " in" : "")}>
            {goal.meta} — <b>{topicCount} topics · {sessionCount} sessions</b>
          </div>
          {goal.list.map((topic, i) => (
            <div
              key={`${goalIdx}-${topic.name}`}
              className={
                "topic" + (shown > i ? " in" : "") + (openIdx === i ? " open" : "")
              }
            >
              <div className="topic-row">
                {topic.name}
                <span className="count">{topic.count} sessions</span>
              </div>
              <div className="sessions-wrap">
                <div className="sessions-clip">
                  <div className="sessions">
                    {topic.sessions.map((s) => (
                      <div className="session" key={s.title}>
                        {s.title}
                        <span className="len">~{s.mins} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="demo-foot">
          <b>One idea per session.</b> Checked before you move on.
        </div>
      </div>
    </div>
  );
}
