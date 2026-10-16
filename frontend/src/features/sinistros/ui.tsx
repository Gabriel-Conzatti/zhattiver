import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';

import type { ClaimServiceType } from '@/lib/api';

export const SERVICE_TYPE_OPTIONS: Array<{ value: ClaimServiceType; label: string }> = [
  { value: 'terceiro', label: 'Apenas Terceiro' },
  { value: 'segurado', label: 'Apenas Segurado' },
  { value: 'segurado_terceiro', label: 'Segurado e Terceiro' },
];

export const COVERAGE_OPTIONS = [
  'Vendaval',
  'Incêndio',
  'Danos elétricos',
  'Responsabilidade Civil',
];

export function serviceTypeLabel(value: string | null): string {
  if (!value) return '—';
  return SERVICE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function includesThirdParty(value: string): boolean {
  return value === 'terceiro' || value === 'segurado_terceiro';
}

export function formatDocument(value: string | null): string {
  if (!value) return '—';
  if (value.length === 11) {
    return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
  }
  if (value.length === 14) {
    return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}`;
  }
  return value;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

/** Valor para `<input type="datetime-local">` no fuso do navegador. */
export function toDateTimeLocal(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function money(value: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

export function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="text-sm text-[#b7cce0]">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="input mt-1 w-full"
      />
    </label>
  );
}

export function Panel({
  title,
  icon: Icon,
  className = '',
  children,
}: {
  title: string;
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`space-y-2 rounded-xl border border-[#18314d] bg-[#0b1d2d] p-3 ${className}`}>
      <h3 className="flex items-center gap-2 font-semibold text-white">
        <Icon className="h-4 w-4 text-[#00CBFF]" /> {title}
      </h3>
      {children}
    </section>
  );
}

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[#6f89a5]">{label}</div>
      <div className="mt-1 break-words">{value}</div>
    </div>
  );
}

export function SmallEmpty({ children }: { children: string }) {
  return <p className="text-sm text-[#6f89a5]">{children}</p>;
}

export function Message({
  children,
  kind = 'empty',
}: {
  children: string;
  kind?: 'empty' | 'error';
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm ${
        kind === 'error'
          ? 'border-red-400/30 bg-red-500/10 text-red-200'
          : 'border-dashed border-[#18314d] text-[#9fb7cf]'
      }`}
    >
      {children}
    </div>
  );
}

export function Modal({
  title,
  description,
  titleId,
  onClose,
  size = 'max-w-2xl',
  children,
}: {
  title: string;
  description?: string;
  titleId: string;
  onClose: () => void;
  size?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
    >
      <div
        className={`max-h-[90vh] w-full ${size} overflow-y-auto rounded-2xl border border-[#244766] bg-[#081d30] p-5 shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-white">
              {title}
            </h2>
            {description && <p className="text-xs text-[#8faac4]">{description}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
