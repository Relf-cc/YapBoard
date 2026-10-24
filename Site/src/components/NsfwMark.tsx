import clsx from 'clsx';
import { Tooltip } from './Tooltip';

/** Red "NSFW" pill for 18+ servers, with a tooltip explaining it. */
export function NsfwMark({ size = 'sm', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <Tooltip
      className={clsx('relative z-10 shrink-0 align-middle', className)}
      content={
        <>
          <span className="block font-semibold text-ink">Adult content, 18+ only</span>
          <span className="block mt-0.5 text-ink-3">Hidden from search unless 18+ results are turned on.</span>
        </>
      }
    >
      <span
        role="img"
        aria-label="NSFW, 18+ only"
        className={clsx(
          'inline-flex items-center rounded-md border border-[#f2555a59] bg-[#f2555a1f] font-sans font-extrabold uppercase tracking-[0.06em] text-[#ff8a8d] leading-none',
          size === 'md' ? 'h-6 px-2 text-[11.5px]' : 'h-[18px] px-1.5 text-[9.5px]',
        )}
      >
        NSFW
      </span>
    </Tooltip>
  );
}
