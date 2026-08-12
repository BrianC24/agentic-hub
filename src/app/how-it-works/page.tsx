import type { Metadata } from "next";
import { TopBar } from "@/components/nav/TopBar";
import {
  ARCHITECTURE,
  BOUNDS,
  FINDINGS,
  JUDGE_LIMITATIONS,
  MODEL_COMPARISON,
  PRODUCTION_GAPS,
  REPAIR_MECHANISMS,
  RUBRIC_CRITERIA,
  sourceUrl,
  STAGES,
} from "@/lib/docs/walkthrough";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "How it works — Agentic Hub",
  description:
    "Stage by stage: what each part of the delivery harness does, the failure it prevents, and the code that implements it.",
};

const FLOW = `ticket
  │
  ├─ 1  intake ............ Zod-validated at the boundary
  │
  ├─ 2  requirements ...... every citation checked against the ticket's own words
  │
  ├─ 3  planning .......... steps cite the requirement ids they satisfy
  │
  ├─ 4  checks ............ objective, free, run before any judge
  │        └── fail ──► back to 3 (bounded)
  │
  ├─ 5  evaluation ........ rubric judge, evidence required per score
  │        └── below threshold ──► back to 3 (bounded)
  │
  └─ 6  approval .......... stops for a human
           └── rejected ──► back to 3, with their note as the instruction`;

export default function HowItWorks() {
  return (
    <>
      <TopBar />
      <main className={styles.main}>
        <div className={styles.hero}>
          <p className={styles.eyebrow}>How it works</p>
          <h1 className={styles.title}>
            Six stages, and what each one stops from going wrong
          </h1>
          <p className={styles.lede}>
            The model call is the easy part. Everything below exists because a model can hand you
            something that looks right and isn&apos;t, and something has to catch it. Every number on
            this page comes from the code it describes.
          </p>
        </div>

        <section className={styles.section}>
          <div className={styles.diagram}>
            <pre>{FLOW}</pre>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>What kind of system this is</h2>
            <p className={styles.sectionLede}>
              <strong>{ARCHITECTURE.claim}</strong> It comes down to one question. Who decides what
              happens next, your code or the model?
            </p>
          </div>
          <div className={styles.prose}>
            {ARCHITECTURE.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th></th>
                  <th>This system</th>
                  <th>An agent</th>
                </tr>
              </thead>
              <tbody>
                {ARCHITECTURE.contrasts.map((row) => (
                  <tr key={row.dimension}>
                    <td>{row.dimension}</td>
                    <td className={styles.wrapCell}>{row.workflow}</td>
                    <td className={styles.wrapCell}>{row.agent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.callout}>
            <strong>{ARCHITECTURE.handoff.heading}. </strong>
            {ARCHITECTURE.handoff.body}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>The stages</h2>
            <p className={styles.sectionLede}>
              Each one covers what it produces, what it stops from going wrong, what I can actually
              show for it, and the code behind it.
            </p>
          </div>

          {STAGES.map((stage) => (
            <article key={stage.id} className={styles.stage}>
              <div className={styles.stageNumber}>{String(stage.number).padStart(2, "0")}</div>
              <div className={styles.stageBody}>
                <h3 className={styles.stageTitle}>{stage.title}</h3>
                <p className={styles.what}>{stage.what}</p>
                <p className={styles.whyBlock}>
                  <span className={styles.whyLabel}>Why it works this way. </span>
                  {stage.why}
                </p>
                <div className={styles.evidence}>
                  {stage.evidence.map((item) => (
                    <div key={item} className={styles.evidenceItem}>
                      <span className={styles.tick} aria-hidden="true">
                        ✓
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.sources}>
                  {stage.sources.map((src) => (
                    <a
                      key={src}
                      className={styles.sourceLink}
                      href={sourceUrl(src)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {src.replace("src/", "")}
                    </a>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Two repair mechanisms, deliberately separated</h2>
            <p className={styles.sectionLede}>
              Both get called &ldquo;retry&rdquo;, but they fire for different reasons, feed back
              different things, and have different limits. Lumping them together hides what actually
              happened in a run.
            </p>
          </div>
          <div className={styles.cards}>
            {REPAIR_MECHANISMS.map((m) => (
              <div key={m.name} className={styles.card}>
                <div className={styles.cardTitle}>{m.name}</div>
                <div className={styles.cardBody}>
                  <strong>Fires when:</strong> {m.trigger}
                </div>
                <div className={styles.cardBody}>
                  <strong>Feeds back:</strong> {m.feedback}
                </div>
                <div className={styles.cardMeta}>bound: {m.bound}</div>
              </div>
            ))}
          </div>
          <div className={styles.callout}>
            <strong>Every loop is bounded three independent ways.</strong>
            <div className={styles.list} style={{ marginTop: "0.5rem" }}>
              {BOUNDS.map((b) => (
                <div key={b} className={styles.listItem}>
                  <span className={styles.bullet}>—</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>What a model judges, and what it does not</h2>
            <p className={styles.sectionLede}>
              Anything I can check objectively gets checked in code. Requirement coverage is just
              counting, and asking a model to do it again would be slower, cost more, and sometimes
              get it wrong. These {RUBRIC_CRITERIA.length} criteria are the parts that really need
              judgment.
            </p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Criterion</th>
                  <th>Question the judge answers</th>
                </tr>
              </thead>
              <tbody>
                {RUBRIC_CRITERIA.map((c) => (
                  <tr key={c.label}>
                    <td>{c.label}</td>
                    <td className={styles.wrapCell}>{c.question}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.callout}>
            <strong>Stated limitations of the judge.</strong>
            <div className={styles.list} style={{ marginTop: "0.5rem" }}>
              {JUDGE_LIMITATIONS.map((l) => (
                <div key={l} className={styles.listItem}>
                  <span className={styles.bullet}>—</span>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>What running it actually taught me</h2>
            <p className={styles.sectionLede}>
              Everything above was built against a mock, using responses I&rsquo;d guessed at. These
              came out of real runs, and a few of them are mistakes in my own assumptions rather than
              anything the model did.
            </p>
          </div>
          <div className={styles.cards}>
            {FINDINGS.map((f) => (
              <div key={f.title} className={styles.card}>
                <div className={styles.cardTitle}>{f.title}</div>
                <div className={styles.cardBody}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Measured cost per run</h2>
            <p className={styles.sectionLede}>
              One full run on the same ticket. These come from the same pricing table the app uses,
              so they can&apos;t drift from what the run report shows.
            </p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Cost per run</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_COMPARISON.map((m) => (
                  <tr key={m.label}>
                    <td>{m.label}</td>
                    <td className={styles.num}>${m.costPerRun.toFixed(3)}</td>
                    <td className={styles.wrapCell}>{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>What would change at production scale</h2>
            <p className={styles.sectionLede}>
              Worth writing down, because knowing what&apos;s missing is part of the job. This plans
              the work. It doesn&apos;t write the code.
            </p>
          </div>
          <div className={styles.list}>
            {PRODUCTION_GAPS.map((g) => (
              <div key={g} className={styles.listItem}>
                <span className={styles.bullet}>—</span>
                <span>{g}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
