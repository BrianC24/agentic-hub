import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketIntakeForm } from "./TicketIntakeForm";

/**
 * The fixture key is what lets a run resolve to its recording. If it does not
 * survive load -> submit, every replay run fails with "no recording".
 */
describe("fixture linkage", () => {
  it("passes the fixture key through when an example is loaded and submitted", async () => {
    const user = userEvent.setup();
    const onValidated = vi.fn();
    render(<TicketIntakeForm onValidated={onValidated} />);

    await user.selectOptions(screen.getByLabelText(/load example/i), "clear-feature-request");
    await user.click(screen.getByRole("button", { name: /validate and run/i }));

    expect(onValidated).toHaveBeenCalledTimes(1);
    expect(onValidated.mock.calls[0][1]).toBe("clear-feature-request");
  });

  it("drops the fixture key once the ticket is edited", async () => {
    const user = userEvent.setup();
    const onValidated = vi.fn();
    render(<TicketIntakeForm onValidated={onValidated} />);

    await user.selectOptions(screen.getByLabelText(/load example/i), "clear-feature-request");
    await user.type(screen.getByLabelText(/^title$/i), " extra");
    await user.click(screen.getByRole("button", { name: /validate and run/i }));

    expect(onValidated.mock.calls[0][1]).toBeNull();
  });
});
