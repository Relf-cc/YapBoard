// Copyright (c) 2026 Christian Relf. All rights reserved.
// Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Ban } from 'lucide-react';
import clsx from 'clsx';
import { compact, timeAgo } from '@/lib/format';
import { APP_STATUS, apiRoot, appFor, platformBase, readScopes, requireMemberPage, SCOPES, SCOPE_ORDER, usageByEndpoint, usageSeries } from '@/lib/platform';
import { AppControls } from '@/components/platform/AppControls';
import { AppForm } from '@/components/platform/AppForm';
import { KeyManager } from '@/components/platform/KeyManager';
import { PageHead } from '@/components/portal/PageHead';

type Props = { params: Promise<{ appId: string }> };

export const metadata: Metadata = { title: 'App' };

const TONE: Record<string, string> = {
  ACTIVE: 'text-ok bg-ok/10 border-ok/30',
  PAUSED: 'text-ink-2 bg-surface-2 border-line-strong',
  SUSPENDED: 'text-warn bg-warn/10 border-warn/30',
  REVOKED: 'text-danger bg-danger/10 border-danger/30',
};

export default async function AppPage({ params }: Props) {
  const { appId } = await params;
  const { member } = await requireMemberPage(`/apps/${appId}`);
  const base = await platformBase();
  const app = await appFor(appId, member.userId);
  if (!app) notFound();

  const [series, byEndpoint] = await Promise.all([usageSeries(app.id), usageByEndpoint(app.id)]);
  const peak = Math.max(1, ...series.map((d) => d.calls));
  const scopes = readScopes(app.scopes);
  const editable = app.status !== 'REVOKED' && member.status === 'ACTIVE';

  return (
    <div className="max-w-5xl">
      <Link href={`${base}/apps`} className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-ink">
        <ArrowLeft size={14} /> Your apps
      </Link>

      <PageHead title={app.name} sub={`Bot ${app.botId} · registered ${timeAgo(app.createdAt)}`}>
        <div className="flex items-center gap-3">
          <span className={clsx('inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold', TONE[app.status] ?? TONE.PAUSED)}>{APP_STATUS[app.status]}</span>
          {editable && <AppControls appId={app.id} name={app.name} status={app.status} base={base} />}
        </div>
      </PageHead>

      {app.statusNote && app.status !== 'ACTIVE' && (
        <div className="card mb-6 flex items-start gap-3 border-warn/30 bg-warn/5 p-4 text-sm">
          <Ban size={17} className="mt-0.5 shrink-0 text-warn" />
          <p>{app.statusNote}</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Calls, last 14 days</h2>
            <span className="text-xs text-ink-3">
              {compact(series.reduce((n, d) => n + d.calls, 0))} calls · {compact(series.reduce((n, d) => n + d.errors, 0))} errors
            </span>
          </div>
          {/* Bars, not a chart: fourteen numbers don't need axes, and this stays readable on a phone. */}
          <ol className="mt-5 flex h-28 items-end gap-1.5">
            {series.map((d) => (
              <li key={d.day} className="flex h-full flex-1 flex-col justify-end gap-0.5" title={`${d.day}: ${d.calls} calls, ${d.errors} errors`}>
                {d.errors > 0 && <span className="block rounded-t-sm bg-warn" style={{ height: `${Math.max(2, (d.errors / peak) * 100)}%` }} />}
                <span
                  className={clsx('block rounded-sm', d.calls ? 'bg-accent' : 'bg-surface-2')}
                  style={{ height: d.calls ? `${Math.max(2, ((d.calls - d.errors) / peak) * 100)}%` : '2px' }}
                />
              </li>
            ))}
          </ol>
          <div className="mt-2 flex justify-between text-[11px] text-ink-3">
            <span>{series[0]?.day}</span>
            <span>today</span>
          </div>
        </section>

        <section className="card overflow-hidden">
          <header className="flex h-14 items-center border-b border-line px-5">
            <h2 className="font-bold">By endpoint</h2>
          </header>
          {byEndpoint.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-3">No calls yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {byEndpoint.map((e) => (
                <li key={e.endpoint} className="flex items-center gap-3 px-5 py-3">
                  <code className="flex-1 font-mono text-[13px] text-ink-2">{e.endpoint}</code>
                  <span className="text-sm font-semibold tabular-nums">{compact(e.calls)}</span>
                  {e.errors > 0 && <span className="text-xs tabular-nums text-warn">{compact(e.errors)} err</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6">
        <KeyManager
          appId={app.id}
          canMint={editable && app.status === 'ACTIVE'}
          keys={app.keys.map((k) => ({
            id: k.id,
            label: k.label,
            prefix: k.prefix,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            revokedAt: k.revokedAt?.toISOString() ?? null,
          }))}
        />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Try it</h2>
        <p className="mt-1 text-[13px] text-ink-3">
          {scopes.length ? 'Swap in a key and a server you own.' : 'No scopes on this app yet - pick some below first.'}
        </p>
        <pre className="mt-3 overflow-x-auto rounded-[10px] border border-line-strong bg-raised p-4 font-mono text-[12.5px] leading-relaxed text-ink-2">
          {`curl -X POST ${apiRoot()}/servers/1234567890/bump \\
  -H "Authorization: Bearer ybp_…" \\
  -H "Content-Type: application/json" \\
  -d '{"user":{"id":"9876543210","username":"ellie"}}'

curl "${apiRoot()}/search/clients?tag=linux" -H "Authorization: Bearer ybp_…"`}
        </pre>
        <Link href={`${base}/docs`} className="btn btn-secondary btn-sm mt-4">
          Full reference
        </Link>
      </section>

      <div className="mt-10">
        <h2 className="font-display text-[20px] font-bold">Settings</h2>
        <p className="mt-1 mb-4 text-sm text-ink-3">
          Scopes you’re allowed: {SCOPE_ORDER.filter((s) => readScopes(member.scopes).includes(s)).map((s) => SCOPES[s].label).join(', ') || 'none yet'}.
        </p>
        {editable ? (
          <AppForm
            base={base}
            allowed={readScopes(member.scopes)}
            scopeOrder={SCOPE_ORDER}
            app={{ id: app.id, botId: app.botId, name: app.name, summary: app.summary, contactUrl: app.contactUrl, scopes }}
          />
        ) : (
          <div className="card max-w-2xl p-5 text-sm text-ink-3">
            {app.status === 'REVOKED' ? 'This app is retired. Register a new one if you want to start again.' : 'Settings are locked while your account is suspended.'}
          </div>
        )}
      </div>
    </div>
  );
}
