// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import { getUser, isStaff } from '@/lib/session';
import { hasPlan } from '@/lib/pro';
import { NavShell } from './NavShell';

export async function Navbar() {
  const user = await getUser();
  // One query per request, memoised with the rest of `planState` (src/lib/pro.ts), so the page body
  // asking the same question again costs nothing.
  const pro = await hasPlan(user?.id);
  return (
    <NavShell
      user={user && { id: user.id, name: user.displayName || user.username, username: user.username, avatarUrl: user.avatarUrl }}
      staff={isStaff(user)}
      pro={pro}
    />
  );
}
