import type { ReactNode } from 'react';

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; /** (ignored) */ sticker?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-primary/20 bg-secondary/40 px-6 py-12 text-center animate-fade-in dark:border-white/10 dark:bg-white/5">
      {icon && <div className="text-4xl">{icon}</div>}
      <p className="font-display text-xl font-extrabold text-ink dark:text-white">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-dark">{description}</p>}
      {action}
    </div>
  );
}
