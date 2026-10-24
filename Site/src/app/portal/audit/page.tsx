import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { portalBase, requireStaffPage } from '@/lib/portal';
import { PageHead } from '@/components/portal/PageHead';
import { auditLabel } from '@/components/portal/audit';

export const metadata: Metadata = { title: 'Audit log' };
const PER_PAGE = 50;

export default async function Audit({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireStaffPage('/audit');
  const base = await portalBase();
  const page = Math.max(1, parseInt((await searchParams).page || '1', 10) || 1);
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { actor: { select: { username: true } } } }),
    db.auditLog.count(),
  ]);
  const target = (type: string, id: string) =>
    type === 'server' ? `${base}/servers?q=${id}` : type === 'user' ? `${base}/users?q=${id}` : type === 'report' ? `${base}/reports/${id}` : type === 'setting' && id === 'voting' ? `${base}/voting` : '#';

  return (
    <div className="max-w-5xl">
      <PageHead title="Audit log" sub="Every staff action, newest first." />
      <div className="card divide-y divide-line">
        {rows.map((a) => (
          <div key={a.id} className="px-5 py-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="w-36 shrink-0 text-xs text-ink-3 tabular-nums">{a.createdAt.toLocaleString('en-GB')}</span>
            <span className="flex-1 min-w-0 text-ink-2">
              <b className="text-ink">@{a.actor.username}</b> {auditLabel(a.action)}{' '}
              <Link href={target(a.targetType, a.targetId)} className="font-mono text-xs text-accent hover:underline">
                {a.targetType}:{a.targetId.slice(0, 14)}
              </Link>
              {a.note && <span className="block mt-0.5 text-ink-3">“{a.note}”</span>}
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="px-5 py-14 text-center text-sm text-ink-3">No actions yet.</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {page > 1 && <Link className="btn btn-secondary btn-sm" href={`${base}/audit?page=${page - 1}`}>Newer</Link>}
        {page * PER_PAGE < total && <Link className="btn btn-secondary btn-sm" href={`${base}/audit?page=${page + 1}`}>Older</Link>}
      </div>
    </div>
  );
}
