// No 'server-only' here (or env.ts, which has it): this runs from instrumentation.ts at server start.
import { db } from './db';

/**
 * Logins used to save STAFF_IDS as an ADMIN role, and it stayed after the ID was taken out of STAFF_IDS. Now a
 * saved role only stands if the portal's Users page set it (every change there is in the audit log as role.*);
 * anything else goes back to USER. STAFF_IDS themselves are applied live by getUser and never saved.
 */
/** Loud warnings at start for production settings that leave something unsafe or broken. */
export function checkProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const weak = (s: string | undefined, min: number) => !s || s.length < min || /change-me/i.test(s);
  const problems = [
    weak(process.env.SESSION_SECRET, 32) && 'SESSION_SECRET is missing, short or the example value: nobody can log in',
    weak(process.env.INTERNAL_API_SECRET, 16) && 'INTERNAL_API_SECRET is missing, short or the example value: the bot is locked out',
    !(process.env.YAPIN_CLIENT_ID && process.env.YAPIN_CLIENT_SECRET) && 'YAPIN_CLIENT_ID / YAPIN_CLIENT_SECRET not set: login is off',
    !process.env.YAPPER_BOT_TOKEN && 'YAPPER_BOT_TOKEN not set: nobody can add servers (owners and admins can’t be checked)',
    !/^https:\/\//.test(process.env.NEXT_PUBLIC_SITE_URL || '') && 'NEXT_PUBLIC_SITE_URL is not https://',
  ].filter(Boolean);
  for (const p of problems) console.error(`[config] ${p}`);
}

export async function resetUngrantedRoles() {
  const staffIds = (process.env.STAFF_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  console.log(`[roles] STAFF_IDS: ${staffIds.length ? staffIds.join(', ') : '(none)'}`);

  // Dev login saves the role it's given ("staff" ticked), with no audit entry. Leave dev databases alone.
  const devLogin = !(process.env.YAPIN_CLIENT_ID && process.env.YAPIN_CLIENT_SECRET) && process.env.NODE_ENV !== 'production';
  if (devLogin) return;

  const users = await db.user.findMany({
    where: { role: { not: 'USER' }, id: { notIn: staffIds } },
    select: { id: true, username: true, role: true },
  });
  for (const u of users) {
    const last = await db.auditLog.findFirst({
      where: { targetType: 'user', targetId: u.id, action: { startsWith: 'role.' } },
      orderBy: { id: 'desc' },
      select: { action: true },
    });
    const granted = last ? last.action.slice('role.'.length).toUpperCase() : 'USER';
    if (granted === u.role) continue;
    await db.user.update({ where: { id: u.id }, data: { role: granted } });
    console.log(`[roles] @${u.username} (${u.id}): ${u.role} -> ${granted} (not in STAFF_IDS, not granted in the portal)`);
  }
}
