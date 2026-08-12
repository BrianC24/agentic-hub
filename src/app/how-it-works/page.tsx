import type { Metadata } from "next";
import { TopBar } from "@/components/nav/TopBar";
import {
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
            Six stages, and the failure each one is designed to prevent
          </h1>
          <p className={styles.lede}>
            The model call is not the interesting part. Everything below exists because a model
            will confidently return something plausible and wrong, and the system has to notice.
            Every number on this page is read from the code that implements it.
          </p>
        </div>

        <section className={styles.section}>
          <div className={styles.diagram}>
            <pre>{FLOW}</pre>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>The stages</h2>
            <p className={styles.sectionLede}>
              Each one lists what it produces, the specific failure it prevents, verifiable
              evidence, and the source that implements it.
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
              Both get called &ldquo;retry&rdquo;. They have different triggers, different feedback,
              and different bounds, and conflating them hides what is actually happening in a run.
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
              Anything objectively decidable is decided in code. Requirement coverage is set
              arithmetic; asking a model to re-derive it would be slower, costlier, and
              occasionally wrong about a fact that is simply computable. These{" "}
              {RUBRIC_CRITERIA.length} criteria are what genuinely needs judgement.
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
              Everything above was built against a mock whose responses I had guessed. These came
              from real runs, and several are defects in my own assumptions rather than the
              model&rsquo;s output.
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
              One full workflow on the same ticket. Read from the pricing table the application
              itself uses, so these cannot drift from what the run report charges.
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
              Written down because knowing the gap is part of the work. This plans changes; it does
              not write code.
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
