// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { announcementsFor } from '@/lib/announcements';
import { getUser } from '@/lib/session';
import { Announcements } from '@/components/Announcements';
import { BetaBar } from '@/components/BetaTag';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { LegalUpdate } from '@/components/LegalUpdate';
import Script from 'next/script';

/**
 * The Issueit bug drop: a floating "Report a bug" button, which sends the console errors, network requests and
 * clicks from just before it was sent along with the description. It lives here rather than in the root layout
 * because that one is shared with the staff portal and the developer platform (see src/proxy.ts), and this
 * button is for visitors. The project id is public by design - it only accepts reports, it cannot read them -
 * but it is read from the environment so a build without it drops the widget and keeps the tighter CSP in
 * next.config.ts closed.
 */
const ISSUEIT_PROJECT = process.env.NEXT_PUBLIC_ISSUEIT_PROJECT;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const announcements = await announcementsFor(user);
  return (
    <>
      {/* Renders nothing in production. On beta it is first, and it does not go away - see BetaTag.tsx. */}
      <BetaBar />
      <Announcements items={announcements} loggedIn={!!user} />
      <Navbar />
      <main>{children}</main>
      <Footer />
      <LegalUpdate />
      {ISSUEIT_PROJECT && <Script src="https://cdn.issueit.app/widget.js" data-project={ISSUEIT_PROJECT} strategy="afterInteractive" />}
    </>
  );
}
