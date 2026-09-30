import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle2 } from 'lucide-react';

import { catalog, leads, schedules, type Schedule } from '@/lib/api';
import { formatPhone } from '@/lib/format';

export function SdrAgendamentosPage() {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({
    lead_id: '',
    product_id: '',
    coverage_end_date: '',
    date_confirmed: true,
    origin_id: '',
    notes: '',
  });

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: catalog.products });
  const originsQuery = useQuery({ queryKey: ['catalog', 'origins'], queryFn: catalog.origins });
  const leadsQuery = useQuery({ queryKey: ['leads', 'sdr-all'], queryFn: () => leads.list({ per_page: 200 }) });
  const listQuery = useQuery({
    queryKey: ['schedules', 'all'],
    queryFn: () => schedules.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      schedules.create({
        lead_id: form.lead_id,
        product_id: form.product_id,
        coverage_end_date: form.coverage_end_date,
        date_confirmed: form.date_confirmed,
        origin_id: form.origin_id || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      setFeedback('Agendamento criado.');
      setForm({ ...form, coverage_end_date: '', notes: '' });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const items = listQuery.data?.items ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-brand-cyan" /> Novo agendamento
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Data final da vigência é obrigatória. Se não estiver confirmada, marque a caixa —
          o item entra normalmente na rotina do vendedor com tag "Data não confirmada" (RN-010).
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div>
            <label className="label">Lead</label>
            <select
              className="input"
              value={form.lead_id}
              onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
              required
            >
              <option value="">Selecione…</option>
              {leadsQuery.data?.items.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.phones[0] ? `— ${formatPhone(l.phones[0])}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Produto</label>
              <select
                className="input"
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                required
              >
                <option value="">Selecione…</option>
                {productsQuery.data?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Origem</label>
              <select
                className="input"
                value={form.origin_id}
                onChange={(e) => setForm({ ...form, origin_id: e.target.value })}
              >
                <option value="">—</option>
                {originsQuery.data?.items.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Vigência final</label>
            <input
              type="date"
              className="input"
              value={form.coverage_end_date}
              onChange={(e) => setForm({ ...form, coverage_end_date: e.target.value })}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={form.date_confirmed}
              onChange={(e) => setForm({ ...form, date_confirmed: e.target.checked })}
            />
            Data confirmada
          </label>
          <div>
            <label className="label">Observações</label>
            <textarea
              className="input h-20"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {feedback && (
            <div className="rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-3 py-2 text-sm">
              <CheckCircle2 className="mr-1 inline h-4 w-4 text-brand-cyan" />
              {feedback}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Salvando…' : 'Cadastrar agendamento'}
          </button>
        </form>
      </section>

      <section className="card overflow-hidden">
        <header className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">Agendamentos cadastrados</h2>
          <p className="text-xs text-text-secondary">Ordenados por vigência mais próxima.</p>
        </header>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Cliente</th>
                <th className="px-4 py-2 text-left">Vigência</th>
                <th className="px-4 py-2 text-left">Dias úteis</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-secondary">
                    Nenhum agendamento cadastrado.
                  </td>
                </tr>
              )}
              {items.map((s: Schedule) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    {s.lead_name ?? '—'}
                    {s.lead_phone && (
                      <div className="text-xs text-text-muted">{formatPhone(s.lead_phone)}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {new Date(s.coverage_end_date).toLocaleDateString('pt-BR')}
                    {!s.date_confirmed && (
                      <span className="ml-2 badge bg-state-warning/20 text-state-warning">
                        Não confirmada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-semibold">{s.view.business_days_remaining}</td>
                  <td className="px-4 py-2">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
