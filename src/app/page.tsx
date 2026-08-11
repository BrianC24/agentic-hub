import { TicketIntakeForm } from "@/components/ticket-intake/TicketIntakeForm";
import { StageRail } from "@/components/workflow/StageRail";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <span className={styles.mark} aria-hidden="true">
            AH
          </span>
          <span className={styles.wordmark}>Agentic Hub</span>
          <span className={styles.topbarMeta}>Stage 1 of 11</span>
        </div>
      </header>

      <main className={styles.main}>
        <StageRail />

        <div className={styles.header}>
          <p className={styles.eyebrow}>Ticket intake</p>
          <h1 className={styles.title}>Start a delivery run from a ticket</h1>
          <p className={styles.lede}>
            Paste or load a Jira-style ticket. It&apos;s validated against a structured schema
            before anything downstream runs — malformed input fails here, not three stages later.
          </p>
        </div>

        <TicketIntakeForm />
      </main>
    </div>
  );
}
