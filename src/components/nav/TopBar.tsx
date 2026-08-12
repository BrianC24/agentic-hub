"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TopBar.module.css";

export interface TopBarProps {
  /** Right-aligned slot for page-specific controls. */
  children?: React.ReactNode;
}

const LINKS = [
  { href: "/", label: "Run" },
  { href: "/how-it-works", label: "How it works" },
];

/** Shared header, so the two views cannot drift apart visually. */
export function TopBar({ children }: TopBarProps) {
  const pathname = usePathname();

  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            AH
          </span>
          <span className={styles.wordmark}>Agentic Hub</span>
        </Link>

        <nav className={styles.nav} aria-label="Sections">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname === link.href ? styles.navLinkActive : ""}`}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.slot}>{children}</div>
      </div>
    </header>
  );
}
