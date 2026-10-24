import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AlertCircle, FlaskConical } from 'lucide-react';
import { devLoginEnabled, env, oauthEnabled } from '@/lib/env';
import { getUser } from '@/lib/session';
import { safeNext } from '@/lib/next-url';
import { LogoMark } from '@/components/Logo';
import { Reveal } from '@/components/Reveal';

export const metadata: Metadata = { title: 'Log in' };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function Login({ searchParams }: Props) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext, env.portalUrl);
  if (await getUser()) redirect(next);

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] flex items-center justify-center px-4 py-16">
      <div aria-hidden className="dots absolute inset-0" />
      <Reveal className="relative w-full max-w-sm">
        <div className="card p-8 text-center">
          <div className="mx-auto w-fit">
            <LogoMark size={48} />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold">Log in to YapBoard</h1>
          <p className="mt-2 text-sm text-ink-3 leading-relaxed">Use your Yapin’ account. We only see your username and avatar.</p>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-left text-sm text-[#ff9b9e]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {oauthEnabled() && (
            <a href={`/api/auth/login?next=${encodeURIComponent(next)}`} className="btn btn-primary btn-lg w-full mt-7">
              Continue with Yapin’
            </a>
          )}

          {devLoginEnabled() && (
            <form action="/api/auth/dev" method="post" className="mt-7 text-left">
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-3 text-[13px] text-warn">
                <FlaskConical size={16} className="mt-0.5 shrink-0" />
                <span>
                  Dev login. Add <code className="font-mono">YAPIN_CLIENT_ID</code> and <code className="font-mono">YAPIN_CLIENT_SECRET</code> to use real Yapin’ accounts.
                </span>
              </div>
              <input type="hidden" name="next" value={next} />
              <label className="label" htmlFor="username">
                Username
              </label>
              <input id="username" name="username" className="field" placeholder="yapper" defaultValue="yapper" required maxLength={24} />
              <label className="mt-3 flex items-center gap-2.5 text-sm text-ink-2 cursor-pointer">
                <input type="checkbox" name="staff" className="size-4 accent-[var(--accent)]" defaultChecked />
                Make me YapBoard staff (to try the portal)
              </label>
              <button className="btn btn-primary btn-lg w-full mt-6">Log in</button>
            </form>
          )}

          {!oauthEnabled() && !devLoginEnabled() && <p className="mt-6 text-sm text-danger">Login isn’t configured on this server.</p>}
        </div>
      </Reveal>
    </div>
  );
}
