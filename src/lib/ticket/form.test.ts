import { describe, expect, it } from "vitest";
import { parseTicketForm, ticketFormValuesFromTicket, type TicketFormValues } from "./form";
import { TICKET_FIXTURES } from "./fixtures";

const baseValues: TicketFormValues = {
  id: "NWB-1",
  title: "Add export button",
  description: "Let users export their data.",
  type: "feature",
  priority: "medium",
  acceptanceCriteria: "Button appears on the toolbar\nClicking it downloads a CSV\n\n",
  labels: "export, toolbar ,",
  reporter: "pm@example.com",
};

describe("parseTicketForm", () => {
  it("splits newline-separated acceptance criteria and drops blank lines", () => {
    const result = parseTicketForm(baseValues);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.acceptanceCriteria).toEqual([
        "Button appears on the toolbar",
        "Clicking it downloads a CSV",
      ]);
    }
  });

  it("splits comma-separated labels and trims whitespace/empties", () => {
    const result = parseTicketForm(baseValues);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.labels).toEqual(["export", "toolbar"]);
    }
  });

  it("surfaces validation errors for blank required fields", () => {
    const result = parseTicketForm({ ...baseValues, title: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path === "title")).toBe(true);
    }
  });
});

describe("ticketFormValuesFromTicket", () => {
  it("round-trips a fixture ticket through form values and back", () => {
    const fixture = TICKET_FIXTURES[0];
    const values = ticketFormValuesFromTicket(fixture.ticket);
    const result = parseTicketForm(values);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket).toEqual(fixture.ticket);
    }
  });
});
