import { parseTicket, type Ticket, type TicketParseResult } from "./schema";

export interface TicketFormValues {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  acceptanceCriteria: string; // newline-separated in the textarea
  labels: string; // comma-separated
  reporter: string;
}

export const EMPTY_TICKET_FORM_VALUES: TicketFormValues = {
  id: "",
  title: "",
  description: "",
  type: "feature",
  priority: "medium",
  acceptanceCriteria: "",
  labels: "",
  reporter: "",
};

export function ticketFormValuesFromTicket(ticket: Ticket): TicketFormValues {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    type: ticket.type,
    priority: ticket.priority,
    acceptanceCriteria: ticket.acceptanceCriteria.join("\n"),
    labels: ticket.labels.join(", "),
    reporter: ticket.reporter,
  };
}

export function parseTicketForm(values: TicketFormValues): TicketParseResult {
  return parseTicket({
    id: values.id.trim(),
    title: values.title.trim(),
    description: values.description.trim(),
    type: values.type,
    priority: values.priority,
    acceptanceCriteria: splitLines(values.acceptanceCriteria),
    labels: splitList(values.labels),
    reporter: values.reporter.trim(),
  });
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
