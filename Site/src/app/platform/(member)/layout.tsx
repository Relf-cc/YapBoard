// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { env } from '@/lib/env';
import { platformBase, requirePlatformUser } from '@/lib/platform';
import { InviteGate } from '@/components/platform/InviteGate';
import { PlatformShell } from '@/components/platform/PlatformShell';

/** The programme: members only. Everyone else gets the invite wall, which is where a code goes. */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const { user, member } = await requirePlatformUser();
  const base = await platformBase();
  if (!member) return <InviteGate username={user.username} siteUrl={env.siteUrl} termsHref={`${base}/program`} />;

  return (
    <PlatformShell user={user} member={member} base={base} siteUrl={env.siteUrl}>
      {children}
    </PlatformShell>
  );
}
