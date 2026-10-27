// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { announcementsFor } from '@/lib/announcements';
import { getUser } from '@/lib/session';
import { Announcements } from '@/components/Announcements';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const announcements = await announcementsFor(user);
  return (
    <>
      <Announcements items={announcements} loggedIn={!!user} />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
