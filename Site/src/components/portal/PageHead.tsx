export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
