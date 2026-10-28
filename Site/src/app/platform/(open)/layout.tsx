// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { env } from '@/lib/env';
import { platformBase, requirePlatformUser } from '@/lib/platform';
import { PlatformShell } from '@/components/platform/PlatformShell';

/**
 * The terms. Signed in is enough: redeeming an invite is what accepts them, so somebody weighing up an invite
 * has to be able to read them first. Members see them inside the usual frame.
 */
export default async function OpenLayout({ children }: { children: React.ReactNode }) {
  const { user, member } = await requirePlatformUser();
  const base = await platformBase();

  return (
    <PlatformShell user={user} member={member} base={base} siteUrl={env.siteUrl}>
      {children}
    </PlatformShell>
  );
}
