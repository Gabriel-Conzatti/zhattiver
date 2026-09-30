import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Undo2 } from 'lucide-react';

import { admin } from '@/lib/api';

const KNOWN_PERMISSIONS = [
  'funnel.view',
  'funnel.work',
  'sales.validate',
  'sales.edit_after_deadline',
  'sales.view_net_premium',
  'sales.view_commission_pct',
  'sales.view_commission_amount',
  'bonus.view_own',
];

export function AdminConcessoesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'grants'], queryFn: admin.grants });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: admin.users });
  const [form, setForm] = useState({
    user_id: '',
    permission: 'funnel.view',
    target_user_id: '',
    starts_at: '',
    ends_at: '',
    reason: '',
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  const usersMap = useMemo(
    () => Object.fromEntries((users.data?.items ?? []).map((u) => [u.id, u.name])),
    [users.data],
  );

  const create = useMutation({
    mutationFn: () =>
      admin.createGrant({
        user_id: form.user_id,
        permission: form.permission,
        target_user_id: form.target_user_id || null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        reason: form.reason || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'grants'] });
      setFeedback('Concessão criada.');
      setForm({ ...form, reason: '', starts_at: '', ends_at: '' });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => admin.revokeGrant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'grants'] }),
  });

  const items = list.data?.items ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-brand-cyan" /> Nova concessão
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Bônus de outros vendedores nunca é delegável (MP-004). Concessões expiram automaticamente
          pela vigência (MP-005).
        </p>
        <div className="mt-3 space-y-3">
          <select
            className="input"
            value={form.user_id}
            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
          >
            <option value="">Usuário beneficiário…</option>
            {users.data?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={form.permission}
            onChange={(e) => setForm({ ...form, permission: e.target.value })}
          >
            {KNOWN_PERMISSIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={form.target_user_id}
            onChange={(e) => setForm({ ...form, target_user_id: e.target.value })}
          >
            <option value="">Substituindo (opcional)</option>
            {users.data?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              className="input"
              placeholder="Início"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
            <input
              type="datetime-local"
              className="input"
              placeholder="Fim"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </div>
          <textarea
            className="input h-16"
            placeholder="Motivo (recomendado)"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => create.mutate()}
            disabled={!form.user_id || !form.permission || create.isPending}
          >
            {create.isPending ? 'Concedendo…' : 'Conceder'}
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
          Concessões vigentes / históricas
        </header>
        {items.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">Nenhuma concessão registrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Usuário</th>
                <th className="px-4 py-2 text-left">Permissão</th>
                <th className="px-4 py-2 text-left">Substituindo</th>
                <th className="px-4 py-2 text-left">Vigência</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <tr key={g.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    {usersMap[g.user_id] ?? g.user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{g.permission}</td>
                  <td className="px-4 py-2 text-xs">
                    {g.target_user_id
                      ? usersMap[g.target_user_id] ?? g.target_user_id.slice(0, 8)
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {g.starts_at ? new Date(g.starts_at).toLocaleString('pt-BR') : '—'}
                    {' → '}
                    {g.ends_at ? new Date(g.ends_at).toLocaleString('pt-BR') : 'indefinido'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`badge ${g.revoked_at ? 'bg-state-danger/20 text-state-danger' : 'bg-state-success/20 text-state-success'}`}
                    >
                      {g.revoked_at ? 'Revogada' : 'Ativa'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!g.revoked_at && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => revoke.mutate(g.id)}
                        disabled={revoke.isPending}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Revogar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
