-- Canonical topic taxonomy for the question bank.
--
-- WHY THIS EXISTS
-- `reference_questions.topic_tags` is each source's OWN free-text vocabulary, copied verbatim by the
-- scrapers (deliberately — see scripts/scrape-step.mjs). Measured against the live corpus before writing
-- this migration, that vocabulary is not usable as a filter:
--   * 366 distinct specific tags over 1,251 tagged rows, and 218 of them occur exactly ONCE.
--   * Selecting the "Pure Mathematics" area returned 195 topic chips from reference_question_facets.
--   * The same topic appears under many spellings: "Differential equation"(33)/"Differential equations"(20),
--     "Complex numbers"(32)/"Complex number"(6)/"Complex Numbers"(1), "Integration"(32)/"Integral"(19)/
--     "Integrals"(6), "SHM"(10)/"Simple harmonic motion"(1), plus outright typos
--     ("Curve sketeching", "Combintorics", "Poission distribution", "Difference equaetions", "Geomtric mean").
--   * `topic_tags[1]` (the "area") is WRONG for a large minority of rows, because STEP's own tagging follows
--     the paper SECTION a question was printed in, and papers mix: the Mechanics area contains
--     "Poisson distribution"(5), "Binomial distribution", "Hypothesis testing" and "Birthday problem", while
--     the Pure Mathematics area contains "Projectile motion"(4), "Friction"(2), "Pulley"(2) and
--     "Collision"(8). Area must therefore be derived from the TOPIC, never from tag position 1.
--   * Many "tags" are not topics at all but the question's flavour text: "How does a chicken cross the
--     road?", "Microtus agrestis", "Harry the Calculating Horse", "Norman army", "Tour de Clochemerle".
--     Charming, useless as a filter, and they crowd out real topics.
--
-- WHAT THIS DOES
-- Maps every observed raw tag onto a bounded three-level canonical taxonomy (area -> strand -> topic) that
-- does NOT grow as more questions are seeded. Raw tags stay on the row untouched, and are still shown on a
-- question as source provenance — this table only governs BROWSING.
--
-- Design decisions worth knowing before editing:
--   * `topic` is NULLABLE on purpose. A tag too generic to place ("Random variable", "Statistics",
--     "Numbers") classifies to its strand and stops there, rather than being guessed into a specific topic.
--   * `kind = 'scenario'` marks flavour text. Those rows still resolve to an area/strand where that is
--     genuinely known, but are excluded from topic facets so they can never appear as a filter chip.
--   * Unmapped tags are NOT silently dropped — reference_topic_coverage() reports them, so seeding a new
--     corpus surfaces exactly what still needs classifying. Check it after every ingest.
--   * Do NOT add rows that differ from an existing one only by case or surrounding whitespace
--     ("Complex Numbers" alongside "Complex numbers"). Resolution normalises with lower(btrim(...)), so
--     they are already covered, and reference_topic_aliases_norm_idx rejects them as duplicates.
--   * RLS is enabled with no client policies, matching `reference_questions`: the only reader is the
--     service-role `reference-questions` edge function.

CREATE TABLE IF NOT EXISTS public.reference_topic_aliases (
  raw_tag text PRIMARY KEY,
  area    text NOT NULL,
  strand  text NOT NULL,
  topic   text,
  kind    text NOT NULL DEFAULT 'topic' CHECK (kind IN ('topic', 'scenario'))
);

ALTER TABLE public.reference_topic_aliases ENABLE ROW LEVEL SECURITY;

-- Matching is case/whitespace-insensitive so a source that changes capitalisation between years does not
-- silently fall out of the taxonomy.
CREATE UNIQUE INDEX IF NOT EXISTS reference_topic_aliases_norm_idx
  ON public.reference_topic_aliases (lower(btrim(raw_tag)));

-- Ordering metadata for the two upper levels, so the UI can present a stable, sensible sequence instead of
-- whatever count order happens to fall out on a given day.
CREATE TABLE IF NOT EXISTS public.reference_topic_strands (
  area     text NOT NULL,
  strand   text NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (area, strand)
);

ALTER TABLE public.reference_topic_strands ENABLE ROW LEVEL SECURITY;

INSERT INTO public.reference_topic_strands (area, strand, position) VALUES
  ('Pure Mathematics', 'Algebra & equations', 1),
  ('Pure Mathematics', 'Sequences & series', 2),
  ('Pure Mathematics', 'Calculus', 3),
  ('Pure Mathematics', 'Geometry', 4),
  ('Pure Mathematics', 'Trigonometry', 5),
  ('Pure Mathematics', 'Complex numbers', 6),
  ('Pure Mathematics', 'Number theory', 7),
  ('Pure Mathematics', 'Combinatorics', 8),
  ('Pure Mathematics', 'Proof & logic', 9),
  ('Pure Mathematics', 'Abstract structures', 10),
  ('Mechanics', 'Kinematics', 1),
  ('Mechanics', 'Forces & statics', 2),
  ('Mechanics', 'Energy & momentum', 3),
  ('Mechanics', 'Oscillations & circular motion', 4),
  ('Mechanics', 'Rigid bodies', 5),
  ('Mechanics', 'Fluids', 6),
  ('Probability and Statistics', 'Probability', 1),
  ('Probability and Statistics', 'Random variables', 2),
  ('Probability and Statistics', 'Distributions', 3),
  ('Probability and Statistics', 'Statistical inference', 4),
  ('Probability and Statistics', 'Stochastic processes', 5)
ON CONFLICT (area, strand) DO UPDATE SET position = EXCLUDED.position;

/* ─────────────────────────────── PURE MATHEMATICS ─────────────────────────────── */

INSERT INTO public.reference_topic_aliases (raw_tag, area, strand, topic, kind) VALUES
  -- Algebra & equations
  ('Polynomials',                    'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Cubic polynomial',               'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Factors of polynomials',         'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Polynomial factors',             'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Roots of polynomials',           'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Roots of equations',             'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Surds and polynomials',          'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Quartic repeated roots',         'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Chebyshev''s polynomial',        'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Hermite polynomials',            'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Rational Functions',             'Pure Mathematics', 'Algebra & equations', 'Polynomials & roots', 'topic'),
  ('Quadratic equations',            'Pure Mathematics', 'Algebra & equations', 'Quadratic, cubic & quartic equations', 'topic'),
  ('Quadratic equation',             'Pure Mathematics', 'Algebra & equations', 'Quadratic, cubic & quartic equations', 'topic'),
  ('Quadratic function',             'Pure Mathematics', 'Algebra & equations', 'Quadratic, cubic & quartic equations', 'topic'),
  ('Quadratic roots inequalities',   'Pure Mathematics', 'Algebra & equations', 'Quadratic, cubic & quartic equations', 'topic'),
  ('Cubic equation',                 'Pure Mathematics', 'Algebra & equations', 'Quadratic, cubic & quartic equations', 'topic'),
  ('Cubic equations',                'Pure Mathematics', 'Algebra & equations', 'Quadratic, cubic & quartic equations', 'topic'),
  ('Quartic equation',               'Pure Mathematics', 'Algebra & equations', 'Quadratic, cubic & quartic equations', 'topic'),
  ('Inequality',                     'Pure Mathematics', 'Algebra & equations', 'Inequalities', 'topic'),
  ('Inequalities',                   'Pure Mathematics', 'Algebra & equations', 'Inequalities', 'topic'),
  ('AM-GM inequality',               'Pure Mathematics', 'Algebra & equations', 'Inequalities', 'topic'),
  ('Arithmetic mean - geometric mean','Pure Mathematics','Algebra & equations', 'Inequalities', 'topic'),
  ('Geomtric mean',                  'Pure Mathematics', 'Algebra & equations', 'Inequalities', 'topic'),
  ('Jensen''s inequality',           'Pure Mathematics', 'Algebra & equations', 'Inequalities', 'topic'),
  ('Schwarz inequality',             'Pure Mathematics', 'Algebra & equations', 'Inequalities', 'topic'),
  ('Concave functions',              'Pure Mathematics', 'Algebra & equations', 'Inequalities', 'topic'),
  ('Convex functions',               'Pure Mathematics', 'Algebra & equations', 'Inequalities', 'topic'),
  ('Simultaneous equations',         'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Functional equations',           'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Functional equation',            'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Polynomial equations',           'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Polynomial equation',            'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Solution of equation',           'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Solution to equations',          'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Solutions of equation',          'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Factorial equations',            'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Implicit equation',              'Pure Mathematics', 'Algebra & equations', 'Simultaneous & functional equations', 'topic'),
  ('Factorisation',                  'Pure Mathematics', 'Algebra & equations', 'Surds, indices & logarithms', 'topic'),
  ('Surds',                          'Pure Mathematics', 'Algebra & equations', 'Surds, indices & logarithms', 'topic'),
  ('Square roots',                   'Pure Mathematics', 'Algebra & equations', 'Surds, indices & logarithms', 'topic'),
  ('Logarithms',                     'Pure Mathematics', 'Algebra & equations', 'Surds, indices & logarithms', 'topic'),
  ('x to the power x to the power x', 'Pure Mathematics', 'Algebra & equations', 'Surds, indices & logarithms', 'topic'),
  ('Modulus function',               'Pure Mathematics', 'Algebra & equations', 'Modulus, floor & piecewise functions', 'topic'),
  ('Floor function',                 'Pure Mathematics', 'Algebra & equations', 'Modulus, floor & piecewise functions', 'topic'),
  ('Graphs of floor functions',      'Pure Mathematics', 'Algebra & equations', 'Modulus, floor & piecewise functions', 'topic'),
  ('Integer part',                   'Pure Mathematics', 'Algebra & equations', 'Modulus, floor & piecewise functions', 'topic'),
  ('Unit fraction',                  'Pure Mathematics', 'Algebra & equations', 'Modulus, floor & piecewise functions', 'topic'),
  ('Magic square',                   'Pure Mathematics', 'Algebra & equations', NULL, 'topic'),
  ('Financial mathematics',          'Pure Mathematics', 'Algebra & equations', NULL, 'topic'),

  -- Sequences & series
  ('Sequences',                      'Pure Mathematics', 'Sequences & series', 'Sequences & progressions', 'topic'),
  ('Periodic sequences',             'Pure Mathematics', 'Sequences & series', 'Sequences & progressions', 'topic'),
  ('Progressions',                   'Pure Mathematics', 'Sequences & series', 'Sequences & progressions', 'topic'),
  ('Geometric progression',          'Pure Mathematics', 'Sequences & series', 'Sequences & progressions', 'topic'),
  ('Geometric sequence',             'Pure Mathematics', 'Sequences & series', 'Sequences & progressions', 'topic'),
  ('Geometric sequences',            'Pure Mathematics', 'Sequences & series', 'Sequences & progressions', 'topic'),
  ('Recurrence relations',           'Pure Mathematics', 'Sequences & series', 'Recurrence & difference equations', 'topic'),
  ('Recurrence relation',            'Pure Mathematics', 'Sequences & series', 'Recurrence & difference equations', 'topic'),
  ('Difference equation',            'Pure Mathematics', 'Sequences & series', 'Recurrence & difference equations', 'topic'),
  ('Difference equaetions',          'Pure Mathematics', 'Sequences & series', 'Recurrence & difference equations', 'topic'),
  ('Logistic map',                   'Pure Mathematics', 'Sequences & series', 'Recurrence & difference equations', 'topic'),
  ('Series',                         'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Sum',                            'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Sum of series',                  'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Product',                        'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Infinite series',                'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Infinite product',               'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Geometric series',               'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Telescoping sums',               'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Basel series',                   'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Inverse cube series',            'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Inverse square root series',     'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Trigonometric series',           'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Trigonometric sums',             'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Arctan sum',                     'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Integration of series',          'Pure Mathematics', 'Sequences & series', 'Series & summation', 'topic'),
  ('Binomial expansion',             'Pure Mathematics', 'Sequences & series', 'Binomial expansion', 'topic'),
  ('Binomial series',                'Pure Mathematics', 'Sequences & series', 'Binomial expansion', 'topic'),
  ('Taylor series',                  'Pure Mathematics', 'Sequences & series', 'Taylor & Maclaurin series', 'topic'),
  ('Maclaurin series',               'Pure Mathematics', 'Sequences & series', 'Taylor & Maclaurin series', 'topic'),
  ('Approximation',                  'Pure Mathematics', 'Sequences & series', 'Approximation & estimation', 'topic'),
  ('Approximations',                 'Pure Mathematics', 'Sequences & series', 'Approximation & estimation', 'topic'),
  ('Binomial approximation',         'Pure Mathematics', 'Sequences & series', 'Approximation & estimation', 'topic'),
  ('Binomial approximations',        'Pure Mathematics', 'Sequences & series', 'Approximation & estimation', 'topic'),
  ('Stirling''s approximation',      'Pure Mathematics', 'Sequences & series', 'Approximation & estimation', 'topic'),
  ('Interval bisection',             'Pure Mathematics', 'Sequences & series', 'Approximation & estimation', 'topic'),

  -- Calculus
  ('Differentiation',                'Pure Mathematics', 'Calculus', 'Differentiation', 'topic'),
  ('Anti-differentiation',           'Pure Mathematics', 'Calculus', 'Differentiation', 'topic'),
  ('Diamond derivative',             'Pure Mathematics', 'Calculus', 'Differentiation', 'topic'),
  ('Diamond derivatives',            'Pure Mathematics', 'Calculus', 'Differentiation', 'topic'),
  ('Derivative of an integral',      'Pure Mathematics', 'Calculus', 'Differentiation', 'topic'),
  ('Integration',                    'Pure Mathematics', 'Calculus', 'Integration', 'topic'),
  ('Integral',                       'Pure Mathematics', 'Calculus', 'Integration', 'topic'),
  ('Integrals',                      'Pure Mathematics', 'Calculus', 'Integration', 'topic'),
  ('Area by integration',            'Pure Mathematics', 'Calculus', 'Integration', 'topic'),
  ('Riemann integration',            'Pure Mathematics', 'Calculus', 'Integration', 'topic'),
  ('Integrating fractional part',    'Pure Mathematics', 'Calculus', 'Integration', 'topic'),
  ('Tan integral',                   'Pure Mathematics', 'Calculus', 'Integration', 'topic'),
  ('arctan integral',                'Pure Mathematics', 'Calculus', 'Integration', 'topic'),
  ('Integration by substitution',    'Pure Mathematics', 'Calculus', 'Integration techniques', 'topic'),
  ('Integration by parts',           'Pure Mathematics', 'Calculus', 'Integration techniques', 'topic'),
  ('Integral reduction',             'Pure Mathematics', 'Calculus', 'Integration techniques', 'topic'),
  ('Integrating factors',            'Pure Mathematics', 'Calculus', 'Integration techniques', 'topic'),
  ('Differential equation',          'Pure Mathematics', 'Calculus', 'Differential equations', 'topic'),
  ('Differential equations',         'Pure Mathematics', 'Calculus', 'Differential equations', 'topic'),
  ('Second order differential equation','Pure Mathematics','Calculus', 'Differential equations', 'topic'),
  ('Curve sketching',                'Pure Mathematics', 'Calculus', 'Curve sketching', 'topic'),
  ('Curve sketeching',               'Pure Mathematics', 'Calculus', 'Curve sketching', 'topic'),
  ('Sketching',                      'Pure Mathematics', 'Calculus', 'Curve sketching', 'topic'),
  ('Curves',                         'Pure Mathematics', 'Calculus', 'Curve sketching', 'topic'),
  ('Intersecting curves number',     'Pure Mathematics', 'Calculus', 'Curve sketching', 'topic'),
  ('Optimisation',                   'Pure Mathematics', 'Calculus', 'Optimisation', 'topic'),
  ('Limit',                          'Pure Mathematics', 'Calculus', 'Limits & analysis', 'topic'),
  ('Limits',                         'Pure Mathematics', 'Calculus', 'Limits & analysis', 'topic'),
  ('Analysis',                       'Pure Mathematics', 'Calculus', 'Limits & analysis', 'topic'),
  ('Volume of revolution',           'Pure Mathematics', 'Calculus', 'Volumes, areas & arc length', 'topic'),
  ('Area/Volume of revolution',      'Pure Mathematics', 'Calculus', 'Volumes, areas & arc length', 'topic'),
  ('Surface of revolution',          'Pure Mathematics', 'Calculus', 'Volumes, areas & arc length', 'topic'),
  ('Volume and Surface area',        'Pure Mathematics', 'Calculus', 'Volumes, areas & arc length', 'topic'),
  ('Area and perimeters',            'Pure Mathematics', 'Calculus', 'Volumes, areas & arc length', 'topic'),
  ('Curvature',                      'Pure Mathematics', 'Calculus', 'Volumes, areas & arc length', 'topic'),
  ('Osculating circle',              'Pure Mathematics', 'Calculus', 'Volumes, areas & arc length', 'topic'),
  ('Parametric equations',           'Pure Mathematics', 'Calculus', 'Parametric equations', 'topic'),
  ('Parametric equation',            'Pure Mathematics', 'Calculus', 'Parametric equations', 'topic'),

  -- Geometry
  ('Coordinate geometry',            'Pure Mathematics', 'Geometry', 'Coordinate geometry', 'topic'),
  ('Euclidean geometry',             'Pure Mathematics', 'Geometry', 'Euclidean geometry', 'topic'),
  ('Elementary geometry',            'Pure Mathematics', 'Geometry', 'Euclidean geometry', 'topic'),
  ('Heron''s formula',               'Pure Mathematics', 'Geometry', 'Euclidean geometry', 'topic'),
  ('Triangle intersection',          'Pure Mathematics', 'Geometry', 'Euclidean geometry', 'topic'),
  ('Touching circles',               'Pure Mathematics', 'Geometry', 'Euclidean geometry', 'topic'),
  ('Clock',                          'Pure Mathematics', 'Geometry', 'Euclidean geometry', 'topic'),
  ('Conic sections',                 'Pure Mathematics', 'Geometry', 'Conic sections', 'topic'),
  ('Ellipse',                        'Pure Mathematics', 'Geometry', 'Conic sections', 'topic'),
  ('Parabola',                       'Pure Mathematics', 'Geometry', 'Conic sections', 'topic'),
  ('Parabola and circle',            'Pure Mathematics', 'Geometry', 'Conic sections', 'topic'),
  ('Parabola normals',               'Pure Mathematics', 'Geometry', 'Conic sections', 'topic'),
  ('Tangent to hyperbola',           'Pure Mathematics', 'Geometry', 'Conic sections', 'topic'),
  ('Vector geometry',                'Pure Mathematics', 'Geometry', 'Vectors & 3-D geometry', 'topic'),
  ('Vectors',                        'Pure Mathematics', 'Geometry', 'Vectors & 3-D geometry', 'topic'),
  ('2d Vector product',              'Pure Mathematics', 'Geometry', 'Vectors & 3-D geometry', 'topic'),
  ('3-D geometry',                   'Pure Mathematics', 'Geometry', 'Vectors & 3-D geometry', 'topic'),
  ('Polar coordinates',              'Pure Mathematics', 'Geometry', 'Polar coordinates', 'topic'),
  ('Polar equations',                'Pure Mathematics', 'Geometry', 'Polar coordinates', 'topic'),
  ('Spherical polar coordinates',    'Pure Mathematics', 'Geometry', 'Polar coordinates', 'topic'),
  ('Transformation',                 'Pure Mathematics', 'Geometry', 'Transformations & matrices', 'topic'),
  ('Transformations',                'Pure Mathematics', 'Geometry', 'Transformations & matrices', 'topic'),
  ('Linear transformation',          'Pure Mathematics', 'Geometry', 'Transformations & matrices', 'topic'),
  ('Matrices',                       'Pure Mathematics', 'Geometry', 'Transformations & matrices', 'topic'),
  ('Mobius map',                     'Pure Mathematics', 'Geometry', 'Transformations & matrices', 'topic'),

  -- Trigonometry
  ('Trigonometry',                   'Pure Mathematics', 'Trigonometry', 'Trigonometry', 'topic'),
  ('Trigonometric equations',        'Pure Mathematics', 'Trigonometry', 'Trigonometry', 'topic'),
  ('Hyperbolic functions',           'Pure Mathematics', 'Trigonometry', 'Hyperbolic & inverse functions', 'topic'),
  ('Arctan',                         'Pure Mathematics', 'Trigonometry', 'Hyperbolic & inverse functions', 'topic'),
  ('Inverse functions',              'Pure Mathematics', 'Trigonometry', 'Hyperbolic & inverse functions', 'topic'),

  -- Complex numbers
  ('Complex numbers',                'Pure Mathematics', 'Complex numbers', 'Complex numbers', 'topic'),
  ('Complex number',                 'Pure Mathematics', 'Complex numbers', 'Complex numbers', 'topic'),
  ('Complex geometry',               'Pure Mathematics', 'Complex numbers', 'Argand diagram geometry', 'topic'),
  ('Argand geometry',                'Pure Mathematics', 'Complex numbers', 'Argand diagram geometry', 'topic'),

  -- Number theory
  ('Number theory',                  'Pure Mathematics', 'Number theory', 'Number theory & primes', 'topic'),
  ('Numbers',                        'Pure Mathematics', 'Number theory', NULL, 'topic'),
  ('Integer sets',                   'Pure Mathematics', 'Number theory', 'Number theory & primes', 'topic'),
  ('Fermat number',                  'Pure Mathematics', 'Number theory', 'Number theory & primes', 'topic'),
  ('Prime number distribution',      'Pure Mathematics', 'Number theory', 'Number theory & primes', 'topic'),
  ('Chebyshev''s theorem',           'Pure Mathematics', 'Number theory', 'Number theory & primes', 'topic'),
  ('Modulo arithmetic',              'Pure Mathematics', 'Number theory', 'Modular arithmetic', 'topic'),
  ('Decimal expansions',             'Pure Mathematics', 'Number theory', 'Modular arithmetic', 'topic'),
  ('Irrational number',              'Pure Mathematics', 'Number theory', 'Irrational & rational numbers', 'topic'),
  ('e is irrational',                'Pure Mathematics', 'Number theory', 'Irrational & rational numbers', 'topic'),
  ('Fibonacci numbers',              'Pure Mathematics', 'Number theory', 'Integer sequences', 'topic'),
  ('Fibonacci number',               'Pure Mathematics', 'Number theory', 'Integer sequences', 'topic'),

  -- Combinatorics
  ('Combinatorics',                  'Pure Mathematics', 'Combinatorics', 'Combinatorics & counting', 'topic'),
  ('Combintorics',                   'Pure Mathematics', 'Combinatorics', 'Combinatorics & counting', 'topic'),
  ('Counting',                       'Pure Mathematics', 'Combinatorics', 'Combinatorics & counting', 'topic'),
  ('Binomial coefficient',           'Pure Mathematics', 'Combinatorics', 'Binomial coefficients', 'topic'),
  ('Binomial coefficients',          'Pure Mathematics', 'Combinatorics', 'Binomial coefficients', 'topic'),
  ('Generating functions',           'Pure Mathematics', 'Combinatorics', 'Generating functions', 'topic'),

  -- Proof & logic
  ('Proof by induction',             'Pure Mathematics', 'Proof & logic', 'Proof by induction', 'topic'),
  ('Induction',                      'Pure Mathematics', 'Proof & logic', 'Proof by induction', 'topic'),
  ('Proof',                          'Pure Mathematics', 'Proof & logic', 'Proof & logic', 'topic'),
  ('Logic',                          'Pure Mathematics', 'Proof & logic', 'Proof & logic', 'topic'),

  -- Abstract structures
  ('Groups',                         'Pure Mathematics', 'Abstract structures', 'Groups', 'topic'),
  ('Functions',                      'Pure Mathematics', 'Abstract structures', 'Functions & mappings', 'topic'),
  ('Coding and Cryptography',        'Pure Mathematics', 'Abstract structures', NULL, 'topic'),

  -- Pure-area flavour text (never a filter chip)
  ('Ant on elastic string',          'Pure Mathematics', 'Calculus', NULL, 'scenario'),
  ('Car with air and rolling resistance','Mechanics', 'Kinematics', NULL, 'scenario'),
  ('Colonel Blotto',                 'Pure Mathematics', 'Combinatorics', NULL, 'scenario'),
  ('Hubble''s constant',             'Pure Mathematics', 'Calculus', NULL, 'scenario'),
  ('Tour de Clochemerle',            'Pure Mathematics', 'Combinatorics', NULL, 'scenario'),

/* ─────────────────────────────────── MECHANICS ─────────────────────────────────── */

  -- Kinematics
  ('Time-distance',                  'Mechanics', 'Kinematics', 'Kinematics & motion graphs', 'topic'),
  ('Time-distance graphs',           'Mechanics', 'Kinematics', 'Kinematics & motion graphs', 'topic'),
  ('Time-displacement',              'Mechanics', 'Kinematics', 'Kinematics & motion graphs', 'topic'),
  ('Acceleration',                   'Mechanics', 'Kinematics', 'Kinematics & motion graphs', 'topic'),
  ('Velocity',                       'Mechanics', 'Kinematics', 'Kinematics & motion graphs', 'topic'),
  ('Vector velocity',                'Mechanics', 'Kinematics', 'Kinematics & motion graphs', 'topic'),
  ('Free-fall',                      'Mechanics', 'Kinematics', 'Kinematics & motion graphs', 'topic'),
  ('Motion on a plane',              'Mechanics', 'Kinematics', 'Kinematics & motion graphs', 'topic'),
  ('Accelerating car',               'Mechanics', 'Kinematics', 'Kinematics & motion graphs', 'topic'),
  ('Projectile motion',              'Mechanics', 'Kinematics', 'Projectile motion', 'topic'),
  ('Projectile',                     'Mechanics', 'Kinematics', 'Projectile motion', 'topic'),
  ('Projectile and tower',           'Mechanics', 'Kinematics', 'Projectile motion', 'topic'),
  ('Air resistance',                 'Mechanics', 'Kinematics', 'Variable acceleration & resisted motion', 'topic'),
  ('Variable mass',                  'Mechanics', 'Kinematics', 'Variable acceleration & resisted motion', 'topic'),

  -- Forces & statics
  ('Equilibrium',                    'Mechanics', 'Forces & statics', 'Equilibrium & statics', 'topic'),
  ('Forces',                         'Mechanics', 'Forces & statics', 'Equilibrium & statics', 'topic'),
  ('Static equilibrium: wall and rod','Mechanics', 'Forces & statics', 'Equilibrium & statics', 'topic'),
  ('Hinged rod',                     'Mechanics', 'Forces & statics', 'Equilibrium & statics', 'topic'),
  ('Ladder',                         'Mechanics', 'Forces & statics', 'Equilibrium & statics', 'topic'),
  ('Plank on cylinders',             'Mechanics', 'Forces & statics', 'Equilibrium & statics', 'topic'),
  ('Repulsive force',                'Mechanics', 'Forces & statics', 'Equilibrium & statics', 'topic'),
  ('Friction',                       'Mechanics', 'Forces & statics', 'Friction', 'topic'),
  ('Friction force',                 'Mechanics', 'Forces & statics', 'Friction', 'topic'),
  ('Pulley',                         'Mechanics', 'Forces & statics', 'Connected particles & pulleys', 'topic'),
  ('Inextensible string',            'Mechanics', 'Forces & statics', 'Connected particles & pulleys', 'topic'),
  ('Inclined plane',                 'Mechanics', 'Forces & statics', 'Inclined planes & wedges', 'topic'),
  ('Wedge',                          'Mechanics', 'Forces & statics', 'Inclined planes & wedges', 'topic'),

  -- Energy & momentum
  ('Energy',                         'Mechanics', 'Energy & momentum', 'Work, energy & power', 'topic'),
  ('Kinetic energy',                 'Mechanics', 'Energy & momentum', 'Work, energy & power', 'topic'),
  ('Work',                           'Mechanics', 'Energy & momentum', 'Work, energy & power', 'topic'),
  ('Work done',                      'Mechanics', 'Energy & momentum', 'Work, energy & power', 'topic'),
  ('Work and power',                 'Mechanics', 'Energy & momentum', 'Work, energy & power', 'topic'),
  ('Power',                          'Mechanics', 'Energy & momentum', 'Work, energy & power', 'topic'),
  ('Collision',                      'Mechanics', 'Energy & momentum', 'Collisions & impulse', 'topic'),
  ('Collisions',                     'Mechanics', 'Energy & momentum', 'Collisions & impulse', 'topic'),
  ('Collision and Friction',         'Mechanics', 'Energy & momentum', 'Collisions & impulse', 'topic'),
  ('Particle collisions',            'Mechanics', 'Energy & momentum', 'Collisions & impulse', 'topic'),
  ('Particle bouncing',              'Mechanics', 'Energy & momentum', 'Collisions & impulse', 'topic'),
  ('Impulse',                        'Mechanics', 'Energy & momentum', 'Collisions & impulse', 'topic'),
  ('Gravitational attraction',       'Mechanics', 'Energy & momentum', 'Gravitation', 'topic'),
  ('Gravitational force',            'Mechanics', 'Energy & momentum', 'Gravitation', 'topic'),

  -- Oscillations & circular motion
  ('Circular motion',                'Mechanics', 'Oscillations & circular motion', 'Circular motion', 'topic'),
  ('Rotating rods',                  'Mechanics', 'Oscillations & circular motion', 'Circular motion', 'topic'),
  ('SHM',                            'Mechanics', 'Oscillations & circular motion', 'Simple harmonic motion', 'topic'),
  ('Simple harmonic motion',         'Mechanics', 'Oscillations & circular motion', 'Simple harmonic motion', 'topic'),
  ('Real pendulum',                  'Mechanics', 'Oscillations & circular motion', 'Simple harmonic motion', 'topic'),
  ('Slack pendulum',                 'Mechanics', 'Oscillations & circular motion', 'Simple harmonic motion', 'topic'),
  ('Hooke''s law',                   'Mechanics', 'Oscillations & circular motion', 'Springs & elastic strings', 'topic'),
  ('Elastic strings',                'Mechanics', 'Oscillations & circular motion', 'Springs & elastic strings', 'topic'),
  ('Springs and strings',            'Mechanics', 'Oscillations & circular motion', 'Springs & elastic strings', 'topic'),
  ('Particles connected by spring',  'Mechanics', 'Oscillations & circular motion', 'Springs & elastic strings', 'topic'),

  -- Rigid bodies
  ('Centre of mass',                 'Mechanics', 'Rigid bodies', 'Centre of mass', 'topic'),
  ('Centre of gravity',              'Mechanics', 'Rigid bodies', 'Centre of mass', 'topic'),
  ('Moment of inertia',              'Mechanics', 'Rigid bodies', 'Moments of inertia & rotation', 'topic'),
  ('Oscillating disc with point mass','Mechanics', 'Rigid bodies', 'Moments of inertia & rotation', 'topic'),

  -- Fluids
  ('Fluid dynamics',                 'Mechanics', 'Fluids', 'Fluid mechanics', 'topic'),

  -- Mechanics flavour text
  ('Beads on wire',                  'Mechanics', 'Forces & statics', NULL, 'scenario'),
  ('Bus and rain',                   'Mechanics', 'Kinematics', NULL, 'scenario'),
  ('Gun carriage',                   'Mechanics', 'Energy & momentum', NULL, 'scenario'),
  ('Motorbike slipping',             'Mechanics', 'Forces & statics', NULL, 'scenario'),
  ('Norman army',                    'Mechanics', 'Kinematics', NULL, 'scenario'),
  ('How does a chicken cross the road?','Mechanics', 'Kinematics', NULL, 'scenario'),

/* ────────────────────────── PROBABILITY AND STATISTICS ────────────────────────── */

  -- Probability
  ('Elementary probability',         'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Probability',                    'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Algebraic probability',          'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Probability with sets',          'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Probability distribution',       'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Coin toss',                      'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Coin tossing',                   'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Coin toss game',                 'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Dice',                           'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Dice roll',                      'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Die',                            'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Pack of cards',                  'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Balls from bags',                'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Random integer',                 'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Tree diagram',                   'Probability and Statistics', 'Probability', 'Elementary probability', 'topic'),
  ('Birthday problem',               'Probability and Statistics', 'Probability', 'Combinatorial probability', 'topic'),
  ('Sampling with/out replacement',  'Probability and Statistics', 'Probability', 'Combinatorial probability', 'topic'),
  ('Sampling with replacement',      'Probability and Statistics', 'Probability', 'Combinatorial probability', 'topic'),
  ('Sampling without replacement',   'Probability and Statistics', 'Probability', 'Combinatorial probability', 'topic'),
  ('Ordering samples',               'Probability and Statistics', 'Probability', 'Combinatorial probability', 'topic'),
  ('Lottery',                        'Probability and Statistics', 'Probability', 'Combinatorial probability', 'topic'),
  ('Raffle tickets',                 'Probability and Statistics', 'Probability', 'Combinatorial probability', 'topic'),
  ('Geometrical probability',        'Probability and Statistics', 'Probability', 'Geometric probability', 'topic'),
  ('Geometric probability',          'Probability and Statistics', 'Probability', 'Geometric probability', 'topic'),
  ('Graphical probability',          'Probability and Statistics', 'Probability', 'Geometric probability', 'topic'),
  ('Independence',                   'Probability and Statistics', 'Probability', 'Conditional probability & independence', 'topic'),
  ('Chebyshev''s inequality',        'Probability and Statistics', 'Probability', 'Probability inequalities', 'topic'),
  ('Indicator function',             'Probability and Statistics', 'Probability', 'Probability inequalities', 'topic'),

  -- Random variables
  ('Discrete random variable',       'Probability and Statistics', 'Random variables', 'Discrete random variables', 'topic'),
  ('Discrete random variables',      'Probability and Statistics', 'Random variables', 'Discrete random variables', 'topic'),
  ('Discrete random distribution',   'Probability and Statistics', 'Random variables', 'Discrete random variables', 'topic'),
  ('Continuous random variable',     'Probability and Statistics', 'Random variables', 'Continuous random variables', 'topic'),
  ('Pdf',                            'Probability and Statistics', 'Random variables', 'Continuous random variables', 'topic'),
  ('Probability density function',   'Probability and Statistics', 'Random variables', 'Continuous random variables', 'topic'),
  ('Cdf',                            'Probability and Statistics', 'Random variables', 'Continuous random variables', 'topic'),
  ('Hazard function',                'Probability and Statistics', 'Random variables', 'Continuous random variables', 'topic'),
  ('Random variable',                'Probability and Statistics', 'Random variables', NULL, 'topic'),
  ('Expectation',                    'Probability and Statistics', 'Random variables', 'Expectation & variance', 'topic'),
  ('Variance',                       'Probability and Statistics', 'Random variables', 'Expectation & variance', 'topic'),
  ('Mean and variances',             'Probability and Statistics', 'Random variables', 'Expectation & variance', 'topic'),
  ('Skewness',                       'Probability and Statistics', 'Random variables', 'Expectation & variance', 'topic'),
  ('Pgf',                            'Probability and Statistics', 'Random variables', 'Generating functions (probability)', 'topic'),
  ('Mgf',                            'Probability and Statistics', 'Random variables', 'Generating functions (probability)', 'topic'),
  ('Moment generating function',     'Probability and Statistics', 'Random variables', 'Generating functions (probability)', 'topic'),
  ('Sum of random variables',        'Probability and Statistics', 'Random variables', 'Sums & transformations of random variables', 'topic'),
  ('Joint distribution',             'Probability and Statistics', 'Random variables', 'Sums & transformations of random variables', 'topic'),

  -- Distributions
  ('Poisson distribution',           'Probability and Statistics', 'Distributions', 'Poisson distribution', 'topic'),
  ('Poisson distributions',          'Probability and Statistics', 'Distributions', 'Poisson distribution', 'topic'),
  ('Poission distribution',          'Probability and Statistics', 'Distributions', 'Poisson distribution', 'topic'),
  ('Poisson process',                'Probability and Statistics', 'Distributions', 'Poisson distribution', 'topic'),
  ('Normal distribution',            'Probability and Statistics', 'Distributions', 'Normal distribution', 'topic'),
  ('Normal distributions',           'Probability and Statistics', 'Distributions', 'Normal distribution', 'topic'),
  ('Truncated normal distribution',  'Probability and Statistics', 'Distributions', 'Normal distribution', 'topic'),
  ('Normal and Uniform distribution','Probability and Statistics', 'Distributions', 'Normal distribution', 'topic'),
  ('Binomial distribution',          'Probability and Statistics', 'Distributions', 'Binomial distribution', 'topic'),
  ('Uniform distribution',           'Probability and Statistics', 'Distributions', 'Uniform & continuous distributions', 'topic'),
  ('Triangular distribution',        'Probability and Statistics', 'Distributions', 'Uniform & continuous distributions', 'topic'),
  ('Exponential distribution',       'Probability and Statistics', 'Distributions', 'Uniform & continuous distributions', 'topic'),
  ('Laplace distribution',           'Probability and Statistics', 'Distributions', 'Other distributions', 'topic'),

  -- Statistical inference
  ('Hypothesis testing',             'Probability and Statistics', 'Statistical inference', 'Hypothesis testing', 'topic'),
  ('MLE',                            'Probability and Statistics', 'Statistical inference', 'Estimation & sampling', 'topic'),
  ('Statistics',                     'Probability and Statistics', 'Statistical inference', NULL, 'topic'),
  ('Corr',                           'Probability and Statistics', 'Statistical inference', 'Summary statistics & correlation', 'topic'),

  -- Stochastic processes
  ('Random walk',                    'Probability and Statistics', 'Stochastic processes', 'Random walks & Markov chains', 'topic'),
  ('Markov chains',                  'Probability and Statistics', 'Stochastic processes', 'Random walks & Markov chains', 'topic'),

  -- Probability flavour text
  ('Coin and sweets',                'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Court of Farnia',                'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Elementary particles',           'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Fishing',                        'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Gambling',                       'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Game show',                      'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Harry the Calculating Horse',    'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Hobbit and Wizard',              'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Internet tester',                'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Mathematitis',                   'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Micro-chip',                     'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Microships',                     'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Microtus agrestis',              'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Oxtown and Camville',            'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Pass the parcel',                'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Pirates',                        'Probability and Statistics', 'Probability', NULL, 'scenario'),
  ('Rabbit warren',                  'Probability and Statistics', 'Probability', NULL, 'scenario')
ON CONFLICT (raw_tag) DO UPDATE
  SET area = EXCLUDED.area, strand = EXCLUDED.strand, topic = EXCLUDED.topic, kind = EXCLUDED.kind;

/* ─────────────────────────── resolution + coverage ─────────────────────────── */

-- The single place that turns a row's raw tags into its canonical classification. Everything else
-- (facets, list filtering, progress) goes through this so there is exactly one definition of "what topic
-- is this question".
--
-- A question can carry several tags resolving to different strands. Rather than duplicate the row across
-- every one, its canonical AREA is the one its tags most agree on, tie-broken by the tag's own order (the
-- source lists the primary topic first). Topics/strands remain multi-valued for filtering: a question is
-- returned by a topic filter if ANY of its tags resolve to that topic.
CREATE OR REPLACE FUNCTION public.reference_question_classified()
RETURNS TABLE (question_id uuid, area text, strands text[], topics text[])
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH resolved AS (
    SELECT rq.id AS question_id, t.ord, a.area, a.strand, a.topic, a.kind
    FROM reference_questions rq
    CROSS JOIN LATERAL unnest(rq.topic_tags) WITH ORDINALITY AS t(tag, ord)
    JOIN reference_topic_aliases a ON lower(btrim(a.raw_tag)) = lower(btrim(t.tag))
  ),
  -- Area by vote: most tags win; ties broken by whichever appeared earliest in the source's own list.
  ranked AS (
    SELECT question_id, area,
           row_number() OVER (PARTITION BY question_id ORDER BY count(*) DESC, min(ord) ASC) AS rn
    FROM resolved
    GROUP BY question_id, area
  )
  SELECT r.question_id,
         (SELECT area FROM ranked k WHERE k.question_id = r.question_id AND k.rn = 1) AS area,
         array_agg(DISTINCT r.strand) AS strands,
         -- 'scenario' tags and strand-only tags contribute no topic, so they can never become a chip.
         COALESCE(array_agg(DISTINCT r.topic) FILTER (WHERE r.topic IS NOT NULL AND r.kind = 'topic'), '{}') AS topics
  FROM resolved r
  GROUP BY r.question_id;
$function$;

-- Seeding a new corpus WILL introduce tags this taxonomy has never seen. This reports them instead of
-- letting them vanish into an "Other" bucket: run it after every ingest and extend the table above.
CREATE OR REPLACE FUNCTION public.reference_topic_coverage()
RETURNS TABLE (raw_tag text, occurrences bigint, sample_competition text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT t.tag AS raw_tag, count(*) AS occurrences, min(rq.source_competition) AS sample_competition
  FROM reference_questions rq
  CROSS JOIN LATERAL unnest(rq.topic_tags) WITH ORDINALITY AS t(tag, ord)
  WHERE t.ord > 1
    AND NOT EXISTS (
      SELECT 1 FROM reference_topic_aliases a
      WHERE lower(btrim(a.raw_tag)) = lower(btrim(t.tag))
    )
  GROUP BY t.tag
  ORDER BY occurrences DESC, t.tag ASC;
$function$;
