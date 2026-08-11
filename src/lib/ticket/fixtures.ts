import type { Ticket } from "./schema";

export interface TicketFixture {
  key: string;
  label: string;
  description: string;
  ticket: Ticket;
}

// Fictional product ("Northwind Boards") and reporters — no real company data.
export const TICKET_FIXTURES: TicketFixture[] = [
  {
    key: "clear-feature-request",
    label: "Clear feature request",
    description: "Well-specified ticket with concrete acceptance criteria.",
    ticket: {
      id: "NWB-142",
      title: "Add CSV export to board activity log",
      description:
        "Team leads want to export a board's activity log to CSV for weekly status reports. The export should cover the currently filtered date range.",
      type: "feature",
      priority: "medium",
      acceptanceCriteria: [
        "An 'Export CSV' button appears above the activity log table",
        "Exported CSV respects the active date-range filter",
        "CSV includes columns: timestamp, actor, action, card title",
        "Export is disabled with a tooltip when the log is empty",
      ],
      labels: ["activity-log", "export"],
      reporter: "pm-northwind@example.com",
    },
  },
  {
    key: "ambiguous-ticket",
    label: "Ambiguous ticket",
    description: "Vague scope, no acceptance criteria, unclear what 'done' means.",
    ticket: {
      id: "NWB-201",
      title: "Improve board performance",
      description: "Boards feel slow sometimes, especially with lots of cards. Can we speed this up?",
      type: "bug",
      priority: "high",
      acceptanceCriteria: [],
      labels: ["performance"],
      reporter: "support-lead@example.com",
    },
  },
  {
    key: "missing-acceptance-criteria",
    label: "Missing acceptance criteria",
    description: "Scope is otherwise clear, but no criteria define done.",
    ticket: {
      id: "NWB-178",
      title: "Add dark mode toggle to settings menu",
      description:
        "Users have asked for a dark mode option. Add a toggle in account settings that switches the app's color theme.",
      type: "feature",
      priority: "low",
      acceptanceCriteria: [],
      labels: ["settings", "theming"],
      reporter: "design-lead@example.com",
    },
  },
];

export function getTicketFixture(key: string): TicketFixture | undefined {
  return TICKET_FIXTURES.find((fixture) => fixture.key === key);
}
