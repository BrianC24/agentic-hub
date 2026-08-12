import { describe, expect, it } from "vitest";
import { CONTACT, INTERESTS, PROFILE, PROJECT_PITCH, ROLES, SKILLS } from "./about";

/**
 * The About page is public and job-facing. These guard the things a hiring
 * reader would notice being wrong or missing.
 */
describe("profile", () => {
  it("has a working primary contact route", () => {
    const primary = CONTACT.filter((c) => c.primary);
    expect(primary.length).toBeGreaterThan(0);
    expect(primary.some((c) => c.href.startsWith("mailto:"))).toBe(true);
  });

  it("uses absolute, well-formed external links", () => {
    for (const link of CONTACT) {
      expect(link.href).toMatch(/^(mailto:|https:\/\/)/);
      expect(link.value.length).toBeGreaterThan(0);
    }
  });

  it("does not publish a phone number", () => {
    // A public page gets scraped; email and LinkedIn are the channels a
    // recruiter actually uses. Removing this test is the deliberate act of
    // deciding otherwise.
    const serialized = JSON.stringify(CONTACT);
    expect(serialized).not.toMatch(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/);
  });

  it("lists roles newest first", () => {
    const years = ROLES.map((r) => Number(r.period.slice(-4)));
    expect([...years].sort((a, b) => b - a)).toEqual(years);
  });

  it("gives every role a company, title, and period", () => {
    for (const role of ROLES) {
      expect(role.company.length).toBeGreaterThan(0);
      expect(role.title.length).toBeGreaterThan(0);
      expect(role.period).toMatch(/\d{4}/);
    }
  });

  it("claims the harness rather than the agent", () => {
    // The positioning the whole project rests on: the scarce skill is making a
    // nondeterministic system trustworthy, not calling a model.
    const pitch = PROJECT_PITCH.body.join(" ").toLowerCase();
    expect(pitch).toContain("harness");
    // Matches the idea rather than one phrasing, so plainer wording does not
    // fail a test that is really about positioning.
    expect(pitch).toMatch(/schema|bounded|validat|deterministic/);
  });

  it("has a summary, skills, and interests", () => {
    expect(PROFILE.summary.length).toBeGreaterThan(80);
    expect(SKILLS.length).toBeGreaterThan(0);
    expect(INTERESTS.length).toBeGreaterThan(0);
  });
});
