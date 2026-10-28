// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import { Logo } from './Logo';
import { BugReportButton } from './BugReport';

const COLS: { title: string; links: [string, string][] }[] = [
  { title: 'Browse', links: [['/servers', 'All servers'], ['/bots', 'All bots'], ['/clients', 'All clients'], ['/tags', 'Tags'], ['/servers?sort=new', 'New servers'], ['/servers?sort=members', 'Biggest servers']] },
  { title: 'List yours', links: [['/add', 'Add a server'], ['/bots/add', 'List a bot'], ['/clients/add', 'List a client'], ['/bots/help', 'Bot listing help'], ['/dashboard', 'Your listings'], ['/bot', 'The bot'], ['/pro', 'YapBoard Pro']] },
  { title: 'YapBoard', links: [['/guidelines', 'Listing guidelines'], ['/terms', 'Terms'], ['/clients/terms', 'Client terms'], ['/privacy', 'Privacy'], ['/platform', 'Developer platform'], ['https://www.yapin.gg', 'Yapin’ ↗']] },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-3 leading-relaxed">The server list for Yapin’. Find people to yap with, or get your community found.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h4 className="text-[13px] font-semibold text-ink mb-3">{c.title}</h4>
            <ul className="space-y-2">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-ink-3 hover:text-ink transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
              {c.title === 'YapBoard' && (
                <li>
                  <BugReportButton className="text-sm text-ink-3 hover:text-ink transition-colors" />
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-10 text-xs text-ink-3 space-y-1">
        <p>
          © {new Date().getFullYear()} Christian Relf. All rights reserved. YapBoard™, its name, logo, design and software are
          proprietary and may not be copied, reproduced or used to run a similar service. See our{' '}
          <Link href="/terms#ours" className="underline decoration-line hover:text-ink transition-colors">
            terms
          </Link>
          .
        </p>
        <p>YapBoard is an independent project and isn’t run by Yapin’.</p>
      </div>
      <div aria-hidden className="overflow-hidden select-none pointer-events-none">
        <p className="text-center font-display font-extrabold leading-[0.8] tracking-[-0.05em] whitespace-nowrap text-[21vw] translate-y-[12%] bg-gradient-to-b from-ink/[0.09] to-ink/[0.015] bg-clip-text text-transparent">
          YapBoard
        </p>
      </div>
    </footer>
  );
}
