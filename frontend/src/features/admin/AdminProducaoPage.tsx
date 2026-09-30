import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';

import { sales, type SaleSummary } from '@/lib/api';

export function AdminProducaoPage() {
  const qc = useQueryClient();
  const [state, setState] = useState<'registered' | 'validated' | 'cancelled' | ''>('registered');
  const query = useQuery({
    queryKey: ['sales', 'admin', state],
    queryFn: () => sales.list({ scope: 'all', state: state || undefined }),
  });
  const [cancelling, setCancelling] = useState<SaleSummary | null>(null);

  const validate = useMutation({
    mutationFn: (id: string) => sales.validate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produção</h1>
          <p className="text-sm text-text-secondary">
            Vendas registradas passam por validação administrativa (RN-036/037). Apenas
            validadas contam para metas, faixas e bônus (RN-038).
          </p>
        </div>
        <div className="flex gap-2">
          {(['registered', 'validated', 'cancelled', ''] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`nav-pill-item ${state === s ? 'bg-brand-blue/20 text-text-primary' : ''}`}
              onClick={() => setState(s)}
            >
              {s === 'registered' && 'Pendentes'}
              {s === 'validated' && 'Validadas'}
              {s === 'cancelled' && 'Canceladas'}
              {s === '' && 'Todas'}
            </button>
          ))}
        </div>
      </header>

      <section className="card overflow-hidden">
        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Fechamento</th>
                <th className="px-4 py-2 text-left">Vendedor</th>
                <th className="px-4 py-2 text-left">Produto</th>
                <th className="px-4 py-2 text-right">Prêmio líquido</th>
                <th className="px-4 py-2 text-right">Comissão</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-secondary">
                    Carregando…
                  </td>
                </tr>
              )}
              {!query.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-secondary">
                    Nenhuma venda.
                  </td>
                </tr>
              )}
              {items.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    {new Date(s.closed_on).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.seller_user_id.slice(0, 8)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.product_id.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-right">R$ {s.net_premium ?? '—'}</td>
                  <td className="px-4 py-2 text-right">R$ {s.commission_amount ?? '—'}</td>
                  <td className="px-4 py-2">
                    <StateBadge state={s.state} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {s.state !== 'validated' && s.state !== 'cancelled' && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => validate.mutate(s.id)}
                          disabled={validate.isPending}
                        >
                          <Check className="h-3.5 w-3.5" /> Validar
                        </button>
                      )}
                      {s.state !== 'cancelled' && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => setCancelling(s)}
                        >
                          <X className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {cancelling && (
        <CancelDialog sale={cancelling} onClose={() => setCancelling(null)} />
      )}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    registered: 'bg-state-warning/20 text-state-warning',
    revision_pending: 'bg-state-warning/20 text-state-warning',
    validated: 'bg-state-success/20 text-state-success',
    cancelled: 'bg-state-danger/20 text-state-danger',
  };
  const label: Record<string, string> = {
    registered: 'Aguardando validação',
    revision_pending: 'Revisão pendente',
    validated: 'Validada',
    cancelled: 'Cancelada',
  };
  return <span className={`badge ${map[state] ?? 'bg-surface-2'}`}>{label[state] ?? state}</span>;
}

function CancelDialog({ sale, onClose }: { sale: SaleSummary; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () => sales.cancel(sale.id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['bonus'] });
      onClose();
    },
    onError: (err) => setError((err as Error).message),
  });
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md card-strong p-6">
        <h3 className="text-base font-semibold">Cancelar venda</h3>
        <p className="mt-1 text-xs text-text-secondary">
          Cancelamento antes do pagamento retira a venda da produção considerada. Depois do
          pagamento, o bônus histórico é preservado (RN-040/041).
        </p>
        <label className="label mt-3">Justificativa</label>
        <textarea
          className="input h-24"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <p className="mt-2 text-xs text-state-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Voltar
          </button>
          <button
            type="button"
            className="btn-orange"
            disabled={reason.trim().length < 3 || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Cancelando…' : 'Cancelar venda'}
          </button>
        </div>
      </div>
    </div>
  );
}
