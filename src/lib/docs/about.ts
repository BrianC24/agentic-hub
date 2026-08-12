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
    "Senior Frontend Engineer with 8+ years building React and TypeScript applications across AI, enterprise, IoT, and analytics products. I've shipped AI-powered support tools, real-time guidance, conversation summarization, Salesforce integrations, and knowledge graph experiences.",
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
    value: "in/brian-canlas",
    href: "https://linkedin.com/in/brian-canlas",
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
    "I've shipped AI features in production. The model call was never the hard part. The hard part was knowing whether I could trust what came back, and being able to show someone else why.",
    "So I built the layer that checks it. Every response is validated against a schema, and if it fails, it goes back to the model with the errors so it can try again. Anything I can verify in normal code, I verify in normal code. I only use an LLM to judge the parts that really need judgment. Every run records what it cost and how long it took.",
    "It also stops and waits for a person before anything is approved. A model can write something that looks right faster than anyone can read it, so someone has to check it before the work gets built. I tried to make that check quick by handling the boring parts first.",
    "I picked turning tickets into plans because the output is something you can actually check. The part I wanted to build was the harness around the model call.",
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
      "Built a Chrome extension in React and TypeScript that keeps customer notes in one place, which made business managers about 35% more productive and stopped customers being asked things they had already answered.",
      "Built the frontend for an AI knowledge graph that pulled several enterprise systems into one place, cutting ramp-up time across business domains by about 50%.",
      "Moved the customer review flow from Trustpilot to Google Reviews for the Mountain View office, which helped take its Google rating from 1.9 to 3.9 stars.",
      "Rolled features out gradually with LaunchDarkly, then watched health, adoption, and user behavior in Datadog and Amplitude.",
      "Used Claude Code day to day to turn Jira tickets into plans, scoped tasks, test strategies, code reviews, and shipped features.",
    ],
  },
  {
    company: "TensorIoT",
    title: "Senior Frontend Engineer",
    period: "Jul 2019 – Jul 2025",
    highlights: [
      "Built React, Next.js, and TypeScript apps for client MVPs and production platforms across IoT, analytics, and data visualization.",
      "Took early client ideas through to shipped products, owning the frontend from requirements and architecture to release.",
      "Designed reusable component libraries and modular frontend systems that got used across several client projects.",
      "Led adoption of Material UI and AWS Cloudscape, which cut duplicated frontend code by about 40%.",
      "Sped up dashboards that render a lot of data, using virtualization, code splitting, caching, and more efficient rendering.",
      "Set up CI/CD pipelines and AWS CloudFront deployments, which made client releases more consistent.",
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
