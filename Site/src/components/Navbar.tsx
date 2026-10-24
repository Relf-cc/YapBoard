import { getUser, isStaff } from '@/lib/session';
import { NavShell } from './NavShell';

export async function Navbar() {
  const user = await getUser();
  return (
    <NavShell
      user={user && { id: user.id, name: user.displayName || user.username, username: user.username, avatarUrl: user.avatarUrl }}
      staff={isStaff(user)}
    />
  );
}
