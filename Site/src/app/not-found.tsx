// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import SiteNotFound from './(site)/not-found';

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main>
        <SiteNotFound />
      </main>
      <Footer />
    </>
  );
}
