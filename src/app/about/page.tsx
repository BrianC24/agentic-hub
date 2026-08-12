import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/nav/TopBar";
import {
  CONTACT,
  INTERESTS,
  LOOKING_FOR,
  PROFILE,
  PROJECT_PITCH,
  ROLES,
  SKILLS,
} from "@/lib/docs/about";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `${PROFILE.name} — ${PROFILE.title}`,
  description: PROFILE.summary,
};

export default function About() {
  return (
    <>
      <TopBar />
      <main className={styles.main}>
        <header className={styles.hero}>
          <h1 className={styles.name}>{PROFILE.name}</h1>
          <div className={styles.roleLine}>
            <span>{PROFILE.title}</span>
            <span className={styles.dot}>·</span>
            <span className={styles.focus}>{PROFILE.focus}</span>
            <span className={styles.dot}>·</span>
            <span>{PROFILE.location}</span>
          </div>
          <p className={styles.summary}>{PROFILE.summary}</p>

          <div className={styles.contactRow}>
            {CONTACT.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`${styles.contact} ${link.primary ? styles.contactPrimary : ""}`}
                target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
              >
                <span className={styles.contactLabel}>{link.label}</span>
                <span className={styles.contactValue}>{link.value}</span>
              </a>
            ))}
          </div>

          <p className={styles.availability}>{LOOKING_FOR}</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{PROJECT_PITCH.heading}</h2>
          <div className={styles.prose}>
            {PROJECT_PITCH.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p>
              You can <Link href="/">run it yourself</Link> — the example tickets replay real
              recorded model output at no cost — or read{" "}
              <Link href="/how-it-works">how each stage works</Link> and why it is built that way.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Experience</h2>
          {ROLES.map((role) => (
            <article key={`${role.company}-${role.period}`} className={styles.role}>
              <div className={styles.roleHead}>
                <span className={styles.company}>{role.company}</span>
                <span className={styles.roleTitle}>{role.title}</span>
                <span className={styles.period}>{role.period}</span>
              </div>
              {role.highlights.length > 0 && (
                <div className={styles.highlights}>
                  {role.highlights.map((item) => (
                    <div key={item} className={styles.highlight}>
                      <span className={styles.bullet}>—</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Skills</h2>
          <div className={styles.skillStack}>
            {SKILLS.map((group) => (
              <div key={group.label} className={styles.skillGroup}>
                <div className={styles.skillLabel}>{group.label}</div>
                <div className={styles.chips}>
                  {group.items.map((item) => (
                    <span key={item} className={styles.chip}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Outside work</h2>
          <div className={styles.chips}>
            {INTERESTS.map((interest) => (
              <span key={interest} className={styles.chip}>
                {interest}
              </span>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
