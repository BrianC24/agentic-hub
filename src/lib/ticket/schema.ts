import { z } from "zod";

export const TicketTypeSchema = z.enum(["feature", "bug", "chore"]);
export const TicketPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const TicketSchema = z.object({
  id: z.string().min(1, "Ticket ID is required"),
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
  description: z.string().min(1, "Description is required"),
  type: TicketTypeSchema,
  priority: TicketPrioritySchema,
  // Optional: missing acceptance criteria is a valid (if incomplete) ticket.
  // Flagging that gap is requirement extraction's job, not intake's.
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
  labels: z.array(z.string().min(1)).default([]),
  reporter: z.string().min(1, "Reporter is required"),
});

export type Ticket = z.infer<typeof TicketSchema>;
export type TicketType = z.infer<typeof TicketTypeSchema>;
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

export interface TicketFieldError {
  path: string;
  message: string;
}

export type TicketParseResult =
  | { success: true; ticket: Ticket }
  | { success: false; errors: TicketFieldError[] };

export function parseTicket(input: unknown): TicketParseResult {
  const result = TicketSchema.safeParse(input);
  if (result.success) {
    return { success: true, ticket: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
