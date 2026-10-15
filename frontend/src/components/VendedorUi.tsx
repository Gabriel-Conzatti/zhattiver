import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type AccentTone = 'cyan' | 'blue' | 'orange' | 'green' | 'red' | 'purple' | 'amber' | 'pink';

export const accentText: Record<AccentTone, string> = {
  cyan: 'text-[#00CBFF]',
  blue: 'text-[#60a5fa]',
  orange: 'text-[#fb923c]',
  green: 'text-[#34d399]',
  red: 'text-[#f87171]',
  purple: 'text-[#c4b5fd]',
  amber: 'text-[#fbbf24]',
  pink: 'text-[#f472b6]',
};

export const accentBox: Record<AccentTone, string> = {
  cyan: 'border-[#00CBFF]/40 bg-[#0c243a] text-[#00CBFF]',
  blue: 'border-[#3b82f6]/40 bg-[#0c1e3a] text-[#60a5fa]',
  orange: 'border-[#f97316]/40 bg-[#241a10] text-[#fb923c]',
  green: 'border-[#22c55e]/40 bg-[#102a22] text-[#34d399]',
  red: 'border-[#ef4444]/40 bg-[#2a1416] text-[#f87171]',
  purple: 'border-[#8b5cf6]/40 bg-[#1d1733] text-[#c4b5fd]',
  amber: 'border-[#f59e0b]/40 bg-[#241c12] text-[#fbbf24]',
  pink: 'border-[#ec4899]/40 bg-[#2a1322] text-[#f472b6]',
};

export const accentBar: Record<AccentTone, string> = {
  cyan: 'from-[#00CBFF] to-[#38bdf8]',
  blue: 'from-[#0ea5e9] to-[#60a5fa]',
  orange: 'from-[#f97316] to-[#fbbf24]',
  green: 'from-[#22c55e] to-[#4ade80]',
  red: 'from-[#ef4444] to-[#f87171]',
  purple: 'from-[#8b5cf6] to-[#c4b5fd]',
  amber: 'from-[#f59e0b] to-[#fbbf24]',
  pink: 'from-[#ec4899] to-[#f472b6]',
};

const badgeTone: Record<AccentTone, string> = {
  cyan: 'border-[#00CBFF]/35 bg-[#00CBFF]/12 text-[#7dd3fc]',
  blue: 'border-[#3b82f6]/35 bg-[#3b82f6]/12 text-[#93c5fd]',
  orange: 'border-[#f97316]/35 bg-[#f97316]/12 text-[#fdba74]',
  green: 'border-[#22c55e]/35 bg-[#22c55e]/12 text-[#86efac]',
  red: 'border-[#ef4444]/35 bg-[#ef4444]/12 text-[#fca5a5]',
  purple: 'border-[#8b5cf6]/35 bg-[#8b5cf6]/12 text-[#c4b5fd]',
  amber: 'border-[#f59e0b]/35 bg-[#f59e0b]/12 text-[#fcd34d]',
  pink: 'border-[#ec4899]/35 bg-[#ec4899]/12 text-[#f9a8d4]',
};

const KEYWORD_TONES: Array<[RegExp, AccentTone]> = [
  [/indica/i, 'blue'],
  [/renova/i, 'green'],
  [/placa/i, 'amber'],
  [/ativo|carteira/i, 'green'],
  [/prospec/i, 'orange'],
  [/org[aâ]nic/i, 'green'],
  [/agendam/i, 'cyan'],
  [/novo/i, 'pink'],
  [/campanha|m[ií]dia/i, 'purple'],
];

const FALLBACK_TONES: AccentTone[] = ['cyan', 'blue', 'orange', 'green', 'purple', 'amber', 'pink'];

export function toneForName(name: string): AccentTone {
  for (const [pattern, tone] of KEYWORD_TONES) {
    if (pattern.test(name)) return tone;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  return FALLBACK_TONES[hash % FALLBACK_TONES.length];
}

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: AccentTone;
}) {
  const resolved = tone ?? toneForName(String(children ?? ''));
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badgeTone[resolved]}`}
    >
      {children}
    </span>
  );
}

export function PanelCard({
  title,
  icon: Icon,
  tone = 'cyan',
  action,
  children,
  className = '',
}: {
  title: string;
  icon?: LucideIcon;
  tone?: AccentTone;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[20px] border border-[#16314d] bg-[#081d30] p-4 shadow-[0_18px_45px_rgba(2,10,22,0.45)] ${className}`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#132c45] pb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          {Icon && <Icon className={`h-5 w-5 ${accentText[tone]}`} aria-hidden="true" />}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function GoalBar({
  label,
  done,
  target,
  tone = 'cyan',
  icon: Icon,
}: {
  label: string;
  done: number;
  target: number;
  tone?: AccentTone;
  icon?: LucideIcon;
}) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (done / target) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${accentBox[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2 text-[13px] text-[#dcecff]">
          <span className="truncate">{label}</span>
          <span className="shrink-0 font-semibold text-white">
            {target > 0 ? `${done}/${target}` : done}
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-[#152b3d]"
          role="progressbar"
          aria-label={label}
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full bg-gradient-to-r ${accentBar[tone]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] text-[#7f9ab6]">
          {target > 0 ? `${Math.round(pct)}% da meta` : 'Meta não configurada'}
        </div>
      </div>
    </div>
  );
}

export function GoalGauge({
  current,
  target,
  caption,
}: {
  current: number;
  target: number;
  caption: string;
}) {
  const pct = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;
  const length = Math.PI * 54;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 128 72" className="h-[72px] w-[128px]" role="img" aria-label={`${caption}: ${current} de ${target}`}>
        <path d="M10 64 A54 54 0 0 1 118 64" fill="none" stroke="#142a3d" strokeWidth="11" strokeLinecap="round" />
        <path
          d="M10 64 A54 54 0 0 1 118 64"
          fill="none"
          stroke="#00CBFF"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${length * pct} ${length}`}
        />
      </svg>
      <div className="-mt-4 text-center">
        <div className="text-xl font-semibold text-white">
          {current} <span className="text-sm font-normal text-[#8faac4]">de {target > 0 ? target : '—'}</span>
        </div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-[#7f9ab6]">{caption}</div>
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'cyan',
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: AccentTone;
}) {
  return (
    <div className="rounded-[16px] border border-[#16314d] bg-[#0a2035] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className={`text-2xl font-semibold ${accentText[tone]}`}>{value}</div>
        {Icon && (
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${accentBox[tone]}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="mt-1 text-xs leading-4 text-[#9bb2c9]">{label}</div>
    </div>
  );
}

export function DayCount({ days, tone }: { days: number; tone?: AccentTone }) {
  const resolved: AccentTone = tone ?? (days < 0 ? 'red' : days <= 2 ? 'orange' : days <= 7 ? 'amber' : 'cyan');
  return (
    <div className="flex flex-col items-center leading-none">
      <span className={`text-2xl font-semibold ${accentText[resolved]}`}>{days}</span>
      <span className="text-[10px] uppercase tracking-[0.1em] text-[#7f9ab6]">
        {Math.abs(days) === 1 ? 'dia' : 'dias'}
      </span>
    </div>
  );
}

export function TableHead({ columns, className = '' }: { columns: string[]; className?: string }) {
  return (
    <div
      className={`grid gap-2 border-b border-[#132c45] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7aa2c8] ${className}`}
    >
      {columns.map((column) => (
        <span key={column}>{column}</span>
      ))}
    </div>
  );
}

export function GoalStrip({
  label,
  done,
  target,
}: {
  label: string;
  done: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (done / target) * 100)) : 0;
  return (
    <div className="min-w-[160px] rounded-[14px] border border-[#16314d] bg-[#0a2035] px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-xs text-[#a9c3da]">
        <span>{label}</span>
        <span className="font-semibold text-white">{target > 0 ? `${done} / ${target}` : done}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[#152b3d]"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full bg-gradient-to-r ${accentBar.cyan}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PageBanner({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#16314d] bg-[#081d30] p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#00CBFF]/40 bg-[#0c243a]">
            <Icon className="h-5 w-5 text-[#00CBFF]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            <p className="text-sm leading-5 text-[#8faac4]">{description}</p>
          </div>
        </div>
        {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </section>
  );
}

export function relativeDays(value: string | null | undefined): string {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Math.floor((Date.now() - then) / 86_400_000);
  if (diff <= 0) return 'Hoje';
  if (diff === 1) return 'Há 1 dia';
  return `Há ${diff} dias`;
}

export function idleLabel(value: string | null | undefined): { text: string; tone: AccentTone } {
  if (!value) return { text: '—', tone: 'cyan' };
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return { text: '—', tone: 'cyan' };
  const hours = Math.max(0, Math.floor((Date.now() - then) / 3_600_000));
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const text = days > 0 ? `${days}d ${rest}h` : `${hours}h`;
  const tone: AccentTone = hours < 24 ? 'green' : hours < 48 ? 'amber' : 'orange';
  return { text, tone };
}

export function formatDateBr(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.slice(0, 10);
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
}
