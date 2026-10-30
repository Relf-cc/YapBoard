// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { announcementsFor } from '@/lib/announcements';
import { getUser } from '@/lib/session';
import { Announcements } from '@/components/Announcements';
import { BetaBar } from '@/components/BetaTag';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { LegalUpdate } from '@/components/LegalUpdate';

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
    </>
  );
}
