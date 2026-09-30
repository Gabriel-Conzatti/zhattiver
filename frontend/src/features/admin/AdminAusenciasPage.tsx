import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserMinus } from 'lucide-react';

import { admin } from '@/lib/api';

export function AdminAusenciasPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'absences'], queryFn: admin.absences });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: admin.users });
  const [form, setForm] = useState({
    user_id: '',
    substitute_user_id: '',
    starts_on: '',
    ends_on: '',
    reason: '',
  });
  const [transfer, setTransfer] = useState({
    from_user_id: '',
    to_user_id: '',
    include_schedules: true,
    include_next_actions: true,
    include_opportunities: false,
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      admin.createAbsence({
        user_id: form.user_id,
        substitute_user_id: form.substitute_user_id || null,
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        reason: form.reason || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'absences'] });
      setFeedback('Ausência registrada.');
      setForm({ ...form, reason: '', starts_on: '', ends_on: '' });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const transferMut = useMutation({
    mutationFn: () => admin.transfer(transfer),
    onSuccess: (data) => {
      setFeedback(
        `Transferidos: ${data.schedules} agendamento(s), ${data.next_actions} follow-up(s), ${data.opportunities} oportunidade(s).`,
      );
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const usersMap = useMemo(
    () => Object.fromEntries((users.data?.items ?? []).map((u) => [u.id, u.name])),
    [users.data],
  );
  const items = list.data?.items ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserMinus className="h-5 w-5 text-brand-cyan" /> Registrar ausência
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Meta de prospecção do ausente não é transferida (RN-068). Ao retornar, oportunidades
          transferidas ficam onde estão (RN-069).
        </p>
        <div className="mt-3 space-y-3">
          <select
            className="input"
            value={form.user_id}
            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
          >
            <option value="">Vendedor ausente…</option>
            {users.data?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <select
            className="input"
            value={form.substitute_user_id}
            onChange={(e) => setForm({ ...form, substitute_user_id: e.target.value })}
          >
            <option value="">Substituto (opcional)</option>
            {users.data?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="input"
              value={form.starts_on}
              onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
            />
            <input
              type="date"
              className="input"
              value={form.ends_on}
              onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
            />
          </div>
          <textarea
            className="input h-16"
            placeholder="Motivo (opcional)"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => create.mutate()}
            disabled={!form.user_id || !form.starts_on || !form.ends_on || create.isPending}
          >
            {create.isPending ? 'Salvando…' : 'Registrar ausência'}
          </button>
        </div>

        <h3 className="mt-6 text-sm font-semibold">Transferir carteira</h3>
        <p className="text-xs text-text-secondary">
          Move agendamentos ativos e follow-ups do vendedor origem para o destino (RN-067).
        </p>
        <div className="mt-2 space-y-2">
          <select
            className="input"
            value={transfer.from_user_id}
            onChange={(e) => setTransfer({ ...transfer, from_user_id: e.target.value })}
          >
            <option value="">De…</option>
            {users.data?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={transfer.to_user_id}
            onChange={(e) => setTransfer({ ...transfer, to_user_id: e.target.value })}
          >
            <option value="">Para…</option>
            {users.data?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={transfer.include_schedules}
              onChange={(e) => setTransfer({ ...transfer, include_schedules: e.target.checked })}
            />
            Agendamentos
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={transfer.include_next_actions}
              onChange={(e) => setTransfer({ ...transfer, include_next_actions: e.target.checked })}
            />
            Follow-ups / próximas ações
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={transfer.include_opportunities}
              onChange={(e) =>
                setTransfer({ ...transfer, include_opportunities: e.target.checked })
              }
            />
            Oportunidades abertas
          </label>
          <button
            type="button"
            className="btn-orange w-full"
            onClick={() => transferMut.mutate()}
            disabled={
              !transfer.from_user_id ||
              !transfer.to_user_id ||
              transfer.from_user_id === transfer.to_user_id ||
              transferMut.isPending
            }
          >
            {transferMut.isPending ? 'Transferindo…' : 'Transferir agora'}
          </button>
        </div>
        {feedback && (
          <p className="mt-3 rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-3 py-2 text-xs">
            {feedback}
          </p>
        )}
      </section>

      <section className="card overflow-hidden">
        <header className="border-b border-border px-4 py-2 text-sm font-semibold">
          Ausências registradas
        </header>
        {items.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">Nenhuma ausência.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Vendedor</th>
                <th className="px-4 py-2 text-left">Período</th>
                <th className="px-4 py-2 text-left">Substituto</th>
                <th className="px-4 py-2 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-2">{usersMap[a.user_id] ?? a.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-xs">
                    {new Date(a.starts_on).toLocaleDateString('pt-BR')} —{' '}
                    {new Date(a.ends_on).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {a.substitute_user_id
                      ? usersMap[a.substitute_user_id] ?? a.substitute_user_id.slice(0, 8)
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">{a.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
