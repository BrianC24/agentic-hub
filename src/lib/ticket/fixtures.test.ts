import { describe, expect, it } from "vitest";
import { TICKET_FIXTURES, getTicketFixture } from "./fixtures";
import { parseTicket } from "./schema";

describe("ticket fixtures", () => {
  it("every fixture is a schema-valid ticket", () => {
    for (const fixture of TICKET_FIXTURES) {
      const result = parseTicket(fixture.ticket);
      expect(result.success, `fixture "${fixture.key}" should be valid`).toBe(true);
    }
  });

  it("has unique keys", () => {
    const keys = TICKET_FIXTURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("getTicketFixture returns undefined for an unknown key", () => {
    expect(getTicketFixture("does-not-exist")).toBeUndefined();
  });
});
