import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { isAdmin } from '@/lib/session';
import { timeAgo } from '@/lib/format';
import { Avatar } from '@/components/Avatar';
import { PageHead } from '@/components/portal/PageHead';
import { Dropdown } from '@/components/Dropdown';
import { UserModButtons } from '@/components/portal/ModButtons';

export const metadata: Metadata = { title: 'Users' };

export default async function PortalUsers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const me = await requireStaffPage('/users');
  const sp = await searchParams;
  const base = await portalBase();
  const q = (sp.q || '').trim().slice(0, 80);
  const filter = sp.filter === 'banned' ? 'banned' : sp.filter === 'staff' ? 'staff' : 'all';

  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ id: q }, { username: { contains: q } }, { displayName: { contains: q } }] } : {}),
    ...(filter === 'banned'
      ? { bannedAt: { not: null } }
      : filter === 'staff'
        ? { AND: [{ OR: [{ role: { in: ['STAFF', 'ADMIN'] } }, { id: { in: env.staffIds } }] }] }
        : {}),
  };
  const found = await db.user.findMany({
    where,
    orderBy: { lastLoginAt: 'desc' },
    take: 60,
    select: {
      id: true, username: true, displayName: true, avatarUrl: true, role: true, bannedAt: true, banReason: true, lastLoginAt: true,
      _count: { select: { servers: true, reports: true } },
    },
  });
  // Same rule as getUser: STAFF_IDS are admins whatever their saved role says.
  const users = found.map((u) => (env.staffIds.includes(u.id) ? { ...u, role: 'ADMIN' } : u));

  return (
    <div className="max-w-6xl">
      <PageHead title="Users" sub="Search by username or Yapin’ ID." />
      <form className="flex flex-wrap gap-2" action={`${base}/users`}>
        <Dropdown
          name="filter"
          label="Show"
          size="md"
          className="w-36"
          defaultValue={filter}
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'staff', label: 'Staff' },
            { value: 'banned', label: 'Banned' },
          ]}
        />
        <input name="q" defaultValue={q} placeholder="Username or ID" className="field h-10 w-64 text-sm" />
        <button className="btn btn-secondary">Search</button>
      </form>

      <div className="mt-5 card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3 border-b border-line">
              <th className="font-medium px-5 h-11">User</th>
              <th className="font-medium px-3">Listings</th>
              <th className="font-medium px-3">Reports sent</th>
              <th className="font-medium px-3">Last seen</th>
              <th className="font-medium px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={u.avatarUrl} name={u.displayName || u.username} id={u.id} size={32} round />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">@{u.username}</span>
                        {u.role !== 'USER' && <span className="text-[10px] uppercase tracking-wider font-bold text-accent">{u.role}</span>}
                        {u.bannedAt && <span className="text-[10px] uppercase tracking-wider font-bold text-danger">banned</span>}
                      </div>
                      <div className="font-mono text-[11px] text-ink-3">{u.id}</div>
                      {u.banReason && <div className="text-xs text-ink-3">“{u.banReason}”</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 tabular-nums text-ink-2">{u._count.servers}</td>
                <td className="px-3 py-3 tabular-nums text-ink-2">{u._count.reports}</td>
                <td className="px-3 py-3 text-ink-3 whitespace-nowrap">{timeAgo(u.lastLoginAt)}</td>
                <td className="px-5 py-3 text-right">
                  <UserModButtons userId={u.id} banned={!!u.bannedAt} role={u.role} canSetRole={isAdmin(me)} self={u.id === me?.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="px-5 py-14 text-center text-sm text-ink-3">No users match.</p>}
      </div>
    </div>
  );
}
