import type { ReactNode } from 'react';

/** Standard page frame: a header band (eyebrow, title, description, actions) followed by the content. */
export function Page({
  title,
  description,
  actions,
  wide,
  eyebrow,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  eyebrow?: string;
  /** (accepted and ignored: the mascot stickers belong to Canix) */
  sticker?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto ${wide ? 'max-w-7xl' : 'max-w-4xl'} px-4 pb-16 pt-5 sm:px-8 sm:pt-8 animate-fade-in`}>
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-gray-medium/60 bg-white px-5 py-5 shadow-soft sm:px-7 sm:py-6 dark:border-white/10 dark:bg-white/5">
        <div className="relative min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
          <h1 className="font-display text-2xl font-black text-ink sm:text-3xl dark:text-white">{title}</h1>
          {description && <div className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-dark">{description}</div>}
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}
