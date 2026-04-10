export type Status = "completed" | "in-progress" | "not-started";

export interface Subtopic {
  id: string;
  title: string;
  status: Status;
}

export interface Topic {
  id: string;
  title: string;
  status: Status;
  subtopics: Subtopic[];
}

export interface Track {
  id: string;
  title: string;
  emoji: string;
  topics: Topic[];
}

export const learningTracks: Track[] = [
  {
    id: "ml",
    title: "Machine Learning",
    emoji: "🧠",
    topics: [
      {
        id: "ml-1",
        title: "Linear Regression",
        status: "completed",
        subtopics: [
          { id: "ml-1-1", title: "Cost Functions", status: "completed" },
          { id: "ml-1-2", title: "Gradient Descent", status: "completed" },
          { id: "ml-1-3", title: "Regularization", status: "completed" },
        ],
      },
      {
        id: "ml-2",
        title: "Neural Networks",
        status: "in-progress",
        subtopics: [
          { id: "ml-2-1", title: "Perceptrons", status: "completed" },
          { id: "ml-2-2", title: "Backpropagation", status: "in-progress" },
          { id: "ml-2-3", title: "Activation Functions", status: "not-started" },
        ],
      },
      {
        id: "ml-3",
        title: "Decision Trees",
        status: "not-started",
        subtopics: [
          { id: "ml-3-1", title: "Entropy & Info Gain", status: "not-started" },
          { id: "ml-3-2", title: "Random Forests", status: "not-started" },
        ],
      },
    ],
  },
  {
    id: "sys",
    title: "Systems Design",
    emoji: "⚙️",
    topics: [
      {
        id: "sys-1",
        title: "Scalability",
        status: "in-progress",
        subtopics: [
          { id: "sys-1-1", title: "Load Balancing", status: "completed" },
          { id: "sys-1-2", title: "Caching Strategies", status: "in-progress" },
          { id: "sys-1-3", title: "Database Sharding", status: "not-started" },
        ],
      },
      {
        id: "sys-2",
        title: "Distributed Systems",
        status: "not-started",
        subtopics: [
          { id: "sys-2-1", title: "CAP Theorem", status: "not-started" },
          { id: "sys-2-2", title: "Consensus Algorithms", status: "not-started" },
        ],
      },
    ],
  },
  {
    id: "math",
    title: "Linear Algebra",
    emoji: "📐",
    topics: [
      {
        id: "math-1",
        title: "Vectors & Spaces",
        status: "completed",
        subtopics: [
          { id: "math-1-1", title: "Vector Operations", status: "completed" },
          { id: "math-1-2", title: "Span & Basis", status: "completed" },
        ],
      },
      {
        id: "math-2",
        title: "Matrix Transformations",
        status: "in-progress",
        subtopics: [
          { id: "math-2-1", title: "Eigenvalues", status: "in-progress" },
          { id: "math-2-2", title: "SVD", status: "not-started" },
        ],
      },
    ],
  },
];

export const userGoals = [
  "Master ML fundamentals by June",
  "Complete Systems Design track",
  "Build a neural network from scratch",
];
