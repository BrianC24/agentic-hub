import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketIntakeForm } from "./TicketIntakeForm";

describe("TicketIntakeForm", () => {
  it("shows validation errors when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<TicketIntakeForm />);

    await user.click(screen.getByRole("button", { name: /validate ticket/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed validation/i);
    expect(screen.getByLabelText(/title/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the validated ticket after a successful submit", async () => {
    const user = userEvent.setup();
    render(<TicketIntakeForm />);

    await user.type(screen.getByLabelText(/ticket id/i), "NWB-9");
    await user.type(screen.getByLabelText(/^title$/i), "Add a thing");
    await user.type(screen.getByLabelText(/description/i), "Users need a thing.");
    await user.type(screen.getByLabelText(/reporter/i), "pm@example.com");

    await user.click(screen.getByRole("button", { name: /validate ticket/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/intake complete/i);
  });

  it("loads an example fixture into the form", async () => {
    const user = userEvent.setup();
    render(<TicketIntakeForm />);

    await user.selectOptions(screen.getByLabelText(/load example/i), "clear-feature-request");

    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Add CSV export to board activity log");
  });

  it("clears the form and result when Clear is clicked", async () => {
    const user = userEvent.setup();
    render(<TicketIntakeForm />);

    await user.click(screen.getByRole("button", { name: /validate ticket/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("");
  });
});
