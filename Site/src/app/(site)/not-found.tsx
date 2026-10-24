import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="relative mx-auto max-w-xl px-4 py-28 text-center">
      <p className="font-display text-[96px] font-extrabold leading-none text-accent">404</p>
      <h1 className="mt-4 text-2xl font-extrabold">Nobody’s yapping here</h1>
      <p className="mt-2 text-ink-3">That page or server doesn’t exist, or it was taken down.</p>
      <div className="mt-8 flex justify-center gap-2">
        <Link href="/servers" className="btn btn-primary">
          Browse servers
        </Link>
        <Link href="/" className="btn btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
