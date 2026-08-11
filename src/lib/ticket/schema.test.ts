import { describe, expect, it } from "vitest";
import { parseTicket } from "./schema";

const validTicket = {
  id: "PORT-101",
  title: "Add CSV export to run history",
  description: "Users need to export a run's evaluation results as CSV.",
  type: "feature",
  priority: "medium",
  acceptanceCriteria: ["Export button appears on completed runs", "CSV includes all eval scores"],
  labels: ["run-history"],
  reporter: "pm@example.com",
};

describe("parseTicket", () => {
  it("accepts a well-formed ticket", () => {
    const result = parseTicket(validTicket);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.title).toBe(validTicket.title);
    }
  });

  it("accepts a ticket with missing acceptance criteria and labels", () => {
    const rest = {
      id: validTicket.id,
      title: validTicket.title,
      description: validTicket.description,
      type: validTicket.type,
      priority: validTicket.priority,
      reporter: validTicket.reporter,
    };
    const result = parseTicket(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.acceptanceCriteria).toEqual([]);
      expect(result.ticket.labels).toEqual([]);
    }
  });

  it("rejects a ticket missing a required field", () => {
    const rest = { ...validTicket, title: undefined };
    const result = parseTicket(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path === "title")).toBe(true);
    }
  });

  it("rejects an invalid priority value", () => {
    const result = parseTicket({ ...validTicket, priority: "urgent" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path === "priority")).toBe(true);
    }
  });

  it("rejects a non-object input", () => {
    const result = parseTicket("not a ticket");
    expect(result.success).toBe(false);
  });
});
