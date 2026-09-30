import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, CalendarCheck, Clock, Send } from 'lucide-react';

import { schedules, type Schedule } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { CopyMessageDialog } from './CopyMessageDialog';

export function AgendamentosPage() {
  const qc = useQueryClient();
  const [contactTarget, setContactTarget] = useState<Schedule | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Schedule | null>(null);

  const query = useQuery({
    queryKey: ['schedules', 'mine'],
    queryFn: () => schedules.list({ scope: 'mine', filter: 'active' }),
  });

  const items = query.data?.items ?? [];
  const today = query.data?.today;

  const inWindow = items.filter((s) => s.view.in_window);
  const overdue = items.filter((s) => s.view.past_contact_limit);
  const upcoming = items.filter((s) => !s.view.in_window && !s.view.past_contact_limit);

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <header className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-blue/20">
            <CalendarCheck className="h-5 w-5 text-brand-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Agendamentos</h1>
            <p className="text-sm text-text-secondary">
              A janela ideal é 5–7 dias úteis antes da vigência (RN-009). O limite para abordagem
              é 2 dias úteis antes (RN-011). Fora do limite, a ação vira "Resolver".
            </p>
          </div>
        </header>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Ativos" value={items.length} icon={<Clock className="h-4 w-4 text-brand-cyan" />} />
          <Metric label="Na janela" value={inWindow.length} icon={<CalendarCheck className="h-4 w-4 text-brand-cyan" />} tone="cyan" />
          <Metric label="Vencidos" value={overdue.length} icon={<AlarmClock className="h-4 w-4 text-state-warning" />} tone="warn" />
          <Metric label="Futuros" value={upcoming.length} icon={<Clock className="h-4 w-4 text-text-muted" />} />
        </div>
      </section>

      <ListBlock
        title="Vencidos — resolver"
        items={overdue}
        empty="Nada vencido."
        onContact={setContactTarget}
        onResolve={setResolveTarget}
      />
      <ListBlock
        title={`Na janela ideal (5–7 dias úteis${today ? ` — hoje ${new Date(today).toLocaleDateString('pt-BR')}` : ''})`}
        items={inWindow}
        empty="Sem agendamentos na janela."
        onContact={setContactTarget}
        onResolve={setResolveTarget}
      />
      <ListBlock
        title="Futuros"
        items={upcoming}
        empty="Sem agendamentos futuros."
        onContact={setContactTarget}
        onResolve={setResolveTarget}
      />

      {contactTarget && (
        <CopyMessageDialog
          leadId={contactTarget.lead_id}
          leadName={contactTarget.lead_name ?? '—'}
          productId={contactTarget.product_id}
          scheduleId={contactTarget.id}
          origin="schedule"
          onClose={() => setContactTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['schedules'] });
            qc.invalidateQueries({ queryKey: ['me', 'goals'] });
          }}
        />
      )}
      {resolveTarget && (
        <ResolveDialog schedule={resolveTarget} onClose={() => setResolveTarget(null)} />
      )}
    </div>
  );
}

function ListBlock({
  title,
  items,
  empty,
  onContact,
  onResolve,
}: {
  title: string;
  items: Schedule[];
  empty: string;
  onContact: (s: Schedule) => void;
  onResolve: (s: Schedule) => void;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-border px-4 py-2 text-sm font-semibold">{title}</header>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-text-secondary">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-4 py-2 text-left">Dias úteis</th>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Vigência</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-2 font-semibold">{s.view.business_days_remaining}</td>
                <td className="px-4 py-2">
                  <div>{s.lead_name ?? '—'}</div>
                  {s.lead_phone && (
                    <div className="text-xs text-text-muted">{formatPhone(s.lead_phone)}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div>{new Date(s.coverage_end_date).toLocaleDateString('pt-BR')}</div>
                  {!s.date_confirmed && (
                    <span className="badge bg-state-warning/20 text-state-warning">
                      Data não confirmada
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  <span
                    className={`badge ${
                      s.view.past_contact_limit
                        ? 'bg-state-warning/20 text-state-warning'
                        : s.view.in_window
                          ? 'bg-brand-cyan/20 text-brand-cyan'
                          : 'bg-surface-2 text-text-secondary'
                    }`}
                  >
                    {s.view.label}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {s.view.past_contact_limit ? (
                    <button type="button" className="btn-orange" onClick={() => onResolve(s)}>
                      Resolver
                    </button>
                  ) : (
                    <button type="button" className="btn-primary" onClick={() => onContact(s)}>
                      <Send className="h-3.5 w-3.5" /> Contatar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'cyan' | 'warn';
}) {
  const cls =
    tone === 'cyan'
      ? 'text-brand-cyan'
      : tone === 'warn'
        ? 'text-state-warning'
        : 'text-text-primary';
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-text-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function ResolveDialog({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      schedules.resolve(schedule.id, { reason: reason.trim(), new_date: newDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      onClose();
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md card-strong p-6">
        <h2 className="text-lg font-semibold">Resolver agendamento</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Justificativa obrigatória. Um novo agendamento será criado com a data informada
          (RN-012/013).
        </p>
        <label className="label mt-4">Justificativa</label>
        <textarea
          className="input h-24"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <label className="label mt-3">Nova data</label>
        <input
          type="date"
          className="input"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
        />
        {error && (
          <div className="mt-3 rounded-lg border border-state-danger/30 bg-state-danger/10 px-3 py-2 text-sm text-state-danger">
            {error}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-orange"
            disabled={mut.isPending || reason.trim().length < 3 || !newDate}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Resolvendo…' : 'Resolver e reagendar'}
          </button>
        </div>
      </div>
    </div>
  );
}
