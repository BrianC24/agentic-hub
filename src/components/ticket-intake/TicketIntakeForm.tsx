"use client";

import { useId, useState } from "react";
import {
  EMPTY_TICKET_FORM_VALUES,
  parseTicketForm,
  ticketFormValuesFromTicket,
  type TicketFormValues,
} from "@/lib/ticket/form";
import { getTicketFixture, TICKET_FIXTURES } from "@/lib/ticket/fixtures";
import type { Ticket, TicketFieldError } from "@/lib/ticket/schema";
import styles from "./TicketIntakeForm.module.css";

interface IntakeState {
  status: "idle" | "success" | "error";
  ticket: Ticket | null;
  errors: TicketFieldError[];
}

const INITIAL_STATE: IntakeState = { status: "idle", ticket: null, errors: [] };

export interface TicketIntakeFormProps {
  /** Called with a schema-valid ticket plus the fixture it came from, if any. */
  onValidated?: (ticket: Ticket, fixtureKey: string | null) => void;
  busy?: boolean;
}

export function TicketIntakeForm({ onValidated, busy = false }: TicketIntakeFormProps = {}) {
  const formId = useId();
  const [values, setValues] = useState<TicketFormValues>(EMPTY_TICKET_FORM_VALUES);
  const [state, setState] = useState<IntakeState>(INITIAL_STATE);
  const [fixtureKey, setFixtureKey] = useState<string | null>(null);

  const errorByPath = new Map(state.errors.map((error) => [error.path, error.message]));

  function updateField<K extends keyof TicketFormValues>(key: K, value: TicketFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseTicketForm(values);
    if (result.success) {
      setState({ status: "success", ticket: result.ticket, errors: [] });
      onValidated?.(result.ticket, fixtureKey);
    } else {
      setState({ status: "error", ticket: null, errors: result.errors });
    }
  }

  function handleLoadFixture(event: React.ChangeEvent<HTMLSelectElement>) {
    const key = event.target.value;
    if (!key) return;
    const fixture = getTicketFixture(key);
    if (!fixture) return;
    setValues(ticketFormValuesFromTicket(fixture.ticket));
    setFixtureKey(fixture.key);
    setState(INITIAL_STATE);
  }

  function handleReset() {
    setValues(EMPTY_TICKET_FORM_VALUES);
    setFixtureKey(null);
    setState(INITIAL_STATE);
  }

  // Editing a loaded example detaches it from its recording, since the
  // replayed responses no longer correspond to the ticket on screen.
  function editField<K extends keyof TicketFormValues>(key: K, value: TicketFormValues[K]) {
    setFixtureKey(null);
    updateField(key, value);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Ticket</span>
          <div className={styles.fixtureBar}>
            <label htmlFor={`${formId}-fixture`}>Load example</label>
            <select id={`${formId}-fixture`} onChange={handleLoadFixture} defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {TICKET_FIXTURES.map((fixture) => (
                <option key={fixture.key} value={fixture.key}>
                  {fixture.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <form id={`${formId}-form`} className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.row}>
            <Field
              id={`${formId}-id`}
              label="Ticket ID"
              placeholder="NWB-142"
              mono
              error={errorByPath.get("id")}
              value={values.id}
              onChange={(v) => editField("id", v)}
            />
            <Field
              id={`${formId}-reporter`}
              label="Reporter"
              placeholder="pm@example.com"
              error={errorByPath.get("reporter")}
              value={values.reporter}
              onChange={(v) => editField("reporter", v)}
            />
          </div>

          <Field
            id={`${formId}-title`}
            label="Title"
            placeholder="Short summary of the request"
            error={errorByPath.get("title")}
            value={values.title}
            onChange={(v) => editField("title", v)}
          />

          <div className={styles.field}>
            <label htmlFor={`${formId}-description`}>Description</label>
            <textarea
              id={`${formId}-description`}
              rows={4}
              placeholder="What needs to change, and why?"
              value={values.description}
              aria-invalid={errorByPath.has("description")}
              aria-describedby={
                errorByPath.has("description") ? `${formId}-description-error` : undefined
              }
              onChange={(e) => editField("description", e.target.value)}
            />
            {errorByPath.has("description") && (
              <span id={`${formId}-description-error`} className={styles.errorText}>
                {errorByPath.get("description")}
              </span>
            )}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor={`${formId}-type`}>Type</label>
              <select
                id={`${formId}-type`}
                value={values.type}
                onChange={(e) => editField("type", e.target.value)}
              >
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
                <option value="chore">Chore</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor={`${formId}-priority`}>Priority</label>
              <select
                id={`${formId}-priority`}
                value={values.priority}
                onChange={(e) => editField("priority", e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor={`${formId}-criteria`}>Acceptance criteria</label>
            <textarea
              id={`${formId}-criteria`}
              rows={4}
              placeholder="One per line"
              value={values.acceptanceCriteria}
              onChange={(e) => editField("acceptanceCriteria", e.target.value)}
            />
            <span className={styles.hint}>
              Optional — an empty list is a valid, if incomplete, ticket. Requirement extraction
              flags the gap.
            </span>
          </div>

          <Field
            id={`${formId}-labels`}
            label="Labels"
            placeholder="activity-log, export"
            error={errorByPath.get("labels")}
            value={values.labels}
            onChange={(v) => editField("labels", v)}
          />
        </form>

        <div className={styles.actions}>
          <button
            type="submit"
            form={`${formId}-form`}
            className={styles.primaryButton}
            disabled={busy}
          >
            {busy ? "Running…" : onValidated ? "Validate and run" : "Validate ticket"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleReset}>
            Clear
          </button>
        </div>
      </div>

      <IntakeResult state={state} />
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  mono?: boolean;
  onChange: (value: string) => void;
}

function Field({ id, label, value, error, placeholder, mono, onChange }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        className={mono ? styles.mono : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <span id={`${id}-error`} className={styles.errorText}>
          {error}
        </span>
      )}
    </div>
  );
}

function IntakeResult({ state }: { state: IntakeState }) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "error") {
    return (
      <div className={`${styles.summary} ${styles.summaryError}`} role="alert">
        <div className={styles.summaryHead}>
          <span className={styles.statusDot} aria-hidden="true" />
          Ticket failed validation — {state.errors.length}{" "}
          {state.errors.length === 1 ? "issue" : "issues"}
        </div>
        <div className={styles.summaryBody}>
          <div className={styles.violations}>
            {state.errors.map((error) => (
              <div key={`${error.path}-${error.message}`} className={styles.violation}>
                <span className={styles.violationPath}>{error.path || "(root)"}</span>
                <span className={styles.violationMessage}>{error.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.summary} ${styles.summarySuccess}`} role="status">
      <div className={styles.summaryHead}>
        <span className={styles.statusDot} aria-hidden="true" />
        Intake complete — schema valid
      </div>
      <div className={styles.summaryBody}>
        <pre className={styles.payload}>{JSON.stringify(state.ticket, null, 2)}</pre>
        <p className={styles.nextStep}>
          This validated object is what requirement extraction consumes next.
        </p>
      </div>
    </div>
  );
}
