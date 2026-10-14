import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Tone = 'cyan' | 'blue' | 'orange' | 'green' | 'purple';

const toneClasses: Record<Tone, string> = {
  cyan: 'border-[#00CBFF]/40 bg-[#0c243a] text-[#00CBFF]',
  blue: 'border-[#0ea5e9]/40 bg-[#0c243a] text-[#7dd3fc]',
  orange: 'border-[#f59e0b]/40 bg-[#241c12] text-[#fbbf24]',
  green: 'border-[#22c55e]/40 bg-[#112b24] text-[#34d399]',
  purple: 'border-[#8b5cf6]/40 bg-[#1d1733] text-[#c4b5fd]',
};

export function DashboardMetricCard({
  label,
  value,
  icon: Icon,
  tone = 'cyan',
  to,
  loading = false,
}: {
  label: string;
  value: number | string | undefined;
  icon: LucideIcon;
  tone?: Tone;
  to?: string;
  loading?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-3xl font-semibold text-white" aria-label={loading ? `${label}: carregando` : undefined}>
          {loading ? '—' : (value ?? '—')}
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl border ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-2 text-sm text-[#a9c3da]">{label}</div>
      {to && <div className="mt-3 text-xs font-medium text-[#7dd3fc]">Abrir detalhes</div>}
    </>
  );

  const className =
    'rounded-[18px] border border-[#16314d] bg-[#091d2d] p-4 transition hover:border-[#00CBFF]/70';

  if (!to) return <section className={className}>{content}</section>;
  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}

export function DashboardPanelMessage({
  children,
  kind = 'empty',
  onRetry,
}: {
  children: ReactNode;
  kind?: 'loading' | 'empty' | 'error';
  onRetry?: () => void;
}) {
  const isError = kind === 'error';
  return (
    <div
      role={isError ? 'alert' : undefined}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      className={`rounded-[14px] border p-4 text-sm ${
        isError
          ? 'border-state-danger/35 bg-state-danger/10 text-[#fecaca]'
          : 'border-dashed border-[#18314d] bg-[#0b1d2d] text-[#9bb2c9]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{children}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-current/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

export function DashboardActionLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-[14px] border border-[#18314d] bg-[#0b1d2d] p-3 transition hover:border-[#00CBFF]/60"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#17314d] bg-[#0d2439] text-[#00CBFF]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="font-medium text-white group-hover:text-[#7dd3fc]">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-[#8faac4]">{description}</div>
      </div>
    </Link>
  );
}
