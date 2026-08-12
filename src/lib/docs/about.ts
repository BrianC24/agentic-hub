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
    "Senior Frontend Engineer with 8+ years building React and TypeScript applications across AI, enterprise, IoT, and analytics products. I have shipped AI-powered support tooling, real-time guidance, conversation summarization, Salesforce integrations, and knowledge-graph experiences.",
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
 * Deliberately claims the harness rather than the agent: the scarce skill is
 * making a nondeterministic system trustworthy, not calling a model.
 */
export const PROJECT_PITCH = {
  heading: "Why I built this",
  body: [
    "Most teams shipping AI features hit the same wall. The model works in the demo, it is unreliable in production, and there is no systematic way to know how unreliable. The usual response is a better prompt, which addresses none of the actual failure modes.",
    "So I built the layer that answers those questions instead: bounded agent loops, schema-validated outputs with a repair path, deterministic checks where correctness is objective, a rubric judge only where judgment is genuinely required, and per-run cost and latency you can inspect.",
    "The ticket-to-implementation-plan domain is the setting. The harness is the point.",
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
      "Built an AI-powered React and TypeScript Chrome extension with centralized customer notes, improving customer continuity by preserving context and reducing repeated questions.",
      "Built frontend experiences for an AI Knowledge Graph consolidating multiple enterprise sources, accelerating cross-team ramp-up.",
      "Developed interfaces for live AI interactions: progressive results, asynchronous states, error handling, and recovery paths.",
      "Managed controlled rollouts with LaunchDarkly, and monitored health and adoption through Datadog and Amplitude.",
      "Used Claude Code and LLM-assisted workflows to turn Jira requirements into implementation plans, scoped tasks, test strategies, and production features.",
    ],
  },
  {
    company: "TensorIoT",
    title: "Senior Frontend Engineer",
    period: "Jul 2019 – Jul 2025",
    highlights: [
      "Owned frontend architecture and delivery for React, Next.js, and TypeScript products across IoT, analytics, and data visualization.",
      "Designed reusable component systems adopted across multiple projects, cutting duplicated frontend code by roughly 40%.",
      "Improved data-intensive dashboard performance through virtualization, code splitting, caching, and more efficient rendering.",
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
  "Open to senior frontend, product engineering, and AI product roles — remote or Los Angeles.";
