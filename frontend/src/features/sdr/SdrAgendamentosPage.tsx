import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Calendar, CheckCircle2 } from 'lucide-react';

import { catalog, leads, schedules, type Schedule } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { ApiRequestError } from '@/lib/http';

const EMPTY_NEW_LEAD = { name: '', phone: '', postal_code: '', city: '', state: '' };

export function SdrAgendamentosPage() {
  const qc = useQueryClient();
  const location = useLocation();
  const firstFieldRef = useRef<HTMLButtonElement | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [newLead, setNewLead] = useState(EMPTY_NEW_LEAD);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({
    lead_id: '',
    product_id: '',
    coverage_end_date: '',
    date_confirmed: true,
    origin_id: '',
    notes: '',
  });

  // Atalho "Novo agendamento" do cabeçalho.
  useEffect(() => {
    if ((location.state as { focusNew?: boolean } | null)?.focusNew) firstFieldRef.current?.focus();
  }, [location.key, location.state]);

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
        ...(mode === 'new'
          ? {
              new_lead: {
                name: newLead.name.trim(),
                phone: newLead.phone.trim(),
                postal_code: newLead.postal_code.trim() || null,
                city: newLead.city.trim() || null,
                state: newLead.state.trim().toUpperCase() || null,
              },
            }
          : { lead_id: form.lead_id }),
        product_id: form.product_id,
        coverage_end_date: form.coverage_end_date,
        date_confirmed: form.date_confirmed,
        origin_id: form.origin_id || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      setFeedback('Agendamento criado.');
      setDuplicate(null);
      setForm({ ...form, coverage_end_date: '', notes: '' });
      if (mode === 'new') {
        setNewLead(EMPTY_NEW_LEAD);
        qc.invalidateQueries({ queryKey: ['leads'] });
      }
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.code === 'duplicate_lead') {
        const details = err.details as { lead_id: string; lead_name: string };
        setDuplicate({ id: details.lead_id, name: details.lead_name });
        setFeedback(null);
        return;
      }
      setDuplicate(null);
      setFeedback((err as Error).message);
    },
  });

  const leadOptions = leadsQuery.data?.items ?? [];
  const selectDuplicate = () => {
    if (!duplicate) return;
    setMode('existing');
    setForm({ ...form, lead_id: duplicate.id });
  };

  const items = listQuery.data?.items ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-brand-cyan" /> Novo agendamento
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Data final da vigência é obrigatória. Se não estiver confirmada, marque a caixa —
          o item entra normalmente na rotina do vendedor com a indicação “Data não confirmada”.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="nav-pill w-max" role="group" aria-label="Cliente do agendamento">
            {(
              [
                ['existing', 'Lead existente'],
                ['new', 'Novo cliente'],
              ] as const
            ).map(([value, label], index) => (
              <button
                key={value}
                ref={index === 0 ? firstFieldRef : undefined}
                type="button"
                className="nav-pill-item"
                data-active={mode === value ? 'true' : 'false'}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setDuplicate(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'existing' ? (
            <div>
              <label className="label" htmlFor="schedule-lead">
                Lead
              </label>
              <select
                id="schedule-lead"
                className="input"
                value={form.lead_id}
                onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
                required
              >
                <option value="">Selecione…</option>
                {duplicate && !leadOptions.some((l) => l.id === duplicate.id) && (
                  <option value={duplicate.id}>{duplicate.name}</option>
                )}
                {leadOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.phones[0] ? `— ${formatPhone(l.phones[0])}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="schedule-new-name">
                  Nome do cliente
                </label>
                <input
                  id="schedule-new-name"
                  className="input"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="schedule-new-phone">
                  Telefone
                </label>
                <input
                  id="schedule-new-phone"
                  className="input"
                  value={newLead.phone}
                  onChange={(e) => {
                    setNewLead({ ...newLead, phone: e.target.value });
                    setDuplicate(null);
                  }}
                  placeholder="(51) 99999-9999"
                  required
                />
              </div>
              <div className="grid grid-cols-[120px_1fr_72px] gap-3">
                <div>
                  <label className="label" htmlFor="schedule-new-cep">
                    CEP (opcional)
                  </label>
                  <input
                    id="schedule-new-cep"
                    className="input"
                    inputMode="numeric"
                    value={newLead.postal_code}
                    onChange={(e) => setNewLead({ ...newLead, postal_code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="schedule-new-city">
                    Cidade
                  </label>
                  <input
                    id="schedule-new-city"
                    className="input"
                    value={newLead.city}
                    onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="schedule-new-state">
                    UF
                  </label>
                  <input
                    id="schedule-new-state"
                    className="input uppercase"
                    maxLength={2}
                    value={newLead.state}
                    onChange={(e) => setNewLead({ ...newLead, state: e.target.value })}
                  />
                </div>
              </div>
              {duplicate && (
                <div className="rounded-lg border border-state-warning/30 bg-state-warning/10 px-3 py-2 text-sm text-state-warning">
                  Este telefone já está na base, no lead “{duplicate.name}”.{' '}
                  <button type="button" className="font-semibold underline" onClick={selectDuplicate}>
                    Usar este lead
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="schedule-product">
                Produto
              </label>
              <select
                id="schedule-product"
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
              <label className="label" htmlFor="schedule-origin">
                Origem
              </label>
              <select
                id="schedule-origin"
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
            <label className="label" htmlFor="schedule-coverage-end">
              Vigência final
            </label>
            <input
              id="schedule-coverage-end"
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
            <label className="label" htmlFor="schedule-notes">
              Observações
            </label>
            <textarea
              id="schedule-notes"
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
