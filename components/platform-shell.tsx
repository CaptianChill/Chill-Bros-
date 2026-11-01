import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./platform-shell.module.css";

export type PlatformShellProps = {
  audience: string;
  title: string;
  description?: string;
  navigation: { label: string; href: string; active?: boolean }[];
  onNavigate?: (label: string) => void;
  accountLabel?: string;
  action?: ReactNode;
  children: ReactNode;
};

/** Shared visual foundation. Access and role filtering remain with the caller. */
export function PlatformShell({ audience, title, description, navigation, onNavigate, accountLabel, action, children }: PlatformShellProps) {
  return <div className={styles.shell}>
    <a href="#platform-content" className={styles.skip}>Skip to content</a>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><Image src="/brand/chill-pros-texas-mobile.jpeg" alt="Chill Pros — Texas logo" width={164} height={150} className={styles.platformLogo} /><small>Service. Simplified.</small></div>
      <p className={styles.workspace}>{audience}</p>
      <nav aria-label={`${audience} navigation`}>{navigation.map(item => <Link key={item.href} href={item.href} onClick={onNavigate ? event => { event.preventDefault(); onNavigate(item.label); } : undefined} aria-current={item.active ? "page" : undefined}>{item.label}</Link>)}</nav>
      <div className={styles.support}>Texas service. Chill confidence.</div>
    </aside>
    <div className={styles.workspaceBody}>
      <header className={styles.topbar}><span>Chill Pros <span aria-hidden="true">/</span> {audience}</span>{accountLabel ? <span className={styles.account}>{accountLabel}</span> : null}</header>
      <main id="platform-content" className={styles.main}>
        <div className={styles.pageHeading}>
          <div className={styles.heroCopy}><p className={styles.eyebrow}>{audience}</p><h1>{title}</h1>{description ? <p>{description}</p> : null}<span className={styles.brandSignature}>KEEP IT COOL. WE’LL HANDLE THE REST.</span></div>
          <div className={styles.heroBadge} aria-hidden="true"><Image src="/brand/chill-pros-texas-mobile.jpeg" alt="" width={132} height={132} /><span>TEXAS ROOTS. CHILL SERVICE.</span></div>
          {action}
        </div>
        {children}
      </main>
    </div>
  </div>;
}
