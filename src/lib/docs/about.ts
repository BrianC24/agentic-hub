/**
 * Profile content for the About page.
 *
 * Kept as data so the page stays a layout concern, and so a test can assert
 * the pieces a hiring reader looks for are actually present.
 */

export const PROFILE = {
  name: "Brian Canlas",
  title: "Senior Frontend Engineer",
  focus: "AI Products & Agentic Workflows",
  location: "Los Angeles, CA",
  summary:
    "Senior Frontend Engineer with 8+ years building React and TypeScript apps across AI, enterprise, IoT, and analytics products. I've shipped AI-powered support tooling, real-time guidance, conversation summarization, Salesforce integrations, and knowledge graph experiences.",
} as const;

export interface ContactLink {
  label: string;
  value: string;
  href: string;
  /** Whether to surface this as a primary call to action. */
  primary?: boolean;
}

export const CONTACT: ContactLink[] = [
  {
    label: "Email",
    value: "canlasbri@gmail.com",
    href: "mailto:canlasbri@gmail.com",
    primary: true,
  },
  {
    label: "LinkedIn",
    value: "in/brian-canlas-57445813b",
    href: "https://linkedin.com/in/brian-canlas-57445813b",
    primary: true,
  },
  {
    label: "GitHub",
    value: "BrianC24/agentic-hub",
    href: "https://github.com/BrianC24/agentic-hub",
  },
];

/**
 * Why this project exists, in the terms a hiring reader cares about.
 *
 * Grounded in first-hand experience rather than a diagnosis of what other
 * teams get wrong. The earlier version opened by telling the industry it was
 * doing it badly, which is a poor look on a page asking someone for a job.
 *
 * Still claims the harness rather than the agent: the scarce skill is making a
 * nondeterministic system trustworthy, not calling a model.
 */
export const PROJECT_PITCH = {
  heading: "Why I built this",
  body: [
    "I've shipped AI features in production, and the hard part was never the model call. It was knowing whether I could trust what came back, and being able to show someone else why.",
    "So I built the layer that answers that. Bounded loops, output checked against a schema with a repair path when it fails, plain code checks for anything you can verify objectively, an LLM judge only where you actually need judgment, and cost and latency tracked on every run.",
    "It also stops and waits for a person before anything gets approved. That gate is deliberate. When a model can produce something plausible faster than anyone can check it, verification is the actual work, and the human sitting there is the last thing standing between a half-thought-out plan and a shipped feature. My job upstream is to make that review fast and specific instead of a gut call.",
    "I picked ticket-to-plan because it's a real task with an output you can actually check, not because the world needs another one of these. The harness around the model call is the part I wanted to build.",
  ],
} as const;

export interface Role {
  company: string;
  title: string;
  period: string;
  highlights: string[];
}

export const ROLES: Role[] = [
  {
    company: "LegalZoom",
    title: "Software Engineer II",
    period: "Oct 2025 – Aug 2026",
    highlights: [
      "Built an AI-powered React and TypeScript Chrome extension with centralized customer notes, so business managers keep context between calls and stop asking customers the same things twice.",
      "Built the frontend for an AI Knowledge Graph that pulled together several enterprise sources, which cut down how long it took people to get up to speed across teams.",
      "Built interfaces for live AI interactions, including progressive results, async states, error handling, and recovery paths.",
      "Ran controlled rollouts with LaunchDarkly and watched health and adoption in Datadog and Amplitude.",
      "Used Claude Code and LLM-assisted workflows to turn Jira requirements into implementation plans, scoped tasks, test strategies, and shipped features.",
    ],
  },
  {
    company: "TensorIoT",
    title: "Senior Frontend Engineer",
    period: "Jul 2019 – Jul 2025",
    highlights: [
      "Owned frontend architecture and delivery for React, Next.js, and TypeScript products across IoT, analytics, and data visualization.",
      "Built reusable component systems that got picked up across several projects, cutting duplicated frontend code by roughly 40%.",
      "Made data-heavy dashboards faster with virtualization, code splitting, caching, and tighter rendering.",
    ],
  },
  {
    company: "Redwood Code Academy",
    title: "Frontend Engineer",
    period: "Aug 2018 – Jul 2019",
    highlights: [],
  },
  {
    company: "CallFire",
    title: "Junior Software Engineer",
    period: "Dec 2017 – Sep 2018",
    highlights: [],
  },
];

export interface SkillGroup {
  label: string;
  items: string[];
}

export const SKILLS: SkillGroup[] = [
  {
    label: "Languages & frameworks",
    items: ["TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Angular", "React Native", "Redux"],
  },
  {
    label: "Frontend & cloud",
    items: ["Material UI", "AWS Cloudscape", "Vite", "HTML", "CSS", "SCSS", "REST APIs", "AWS", "CI/CD"],
  },
  {
    label: "AI & tooling",
    items: [
      "LLM integration",
      "Agentic workflows",
      "Structured outputs",
      "Evaluations",
      "Claude Code",
      "LaunchDarkly",
      "Datadog",
      "Amplitude",
      "Salesforce",
      "Git",
    ],
  },
];

export const INTERESTS = [
  "Traveling",
  "Running",
  "Basketball",
  "Pickleball",
  "Gaming",
  "Movies",
] as const;

export const LOOKING_FOR =
  "Open to senior frontend, product engineering, and AI product roles. Remote or Los Angeles.";
