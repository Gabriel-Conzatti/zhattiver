import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, RotateCw, Trophy } from 'lucide-react';

import { bonusApi } from '@/lib/api';

export function AdminBonusPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const list = useQuery({
    queryKey: ['admin', 'bonus', year, month],
    queryFn: () => bonusApi.adminList({ year, month }),
  });

  const refresh = useMutation({
    mutationFn: () => bonusApi.refresh(year, month),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'bonus', year, month] }),
  });
  const approve = useMutation({
    mutationFn: (id: string) => bonusApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'bonus', year, month] }),
  });
  const pay = useMutation({
    mutationFn: (id: string) => bonusApi.pay(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'bonus', year, month] }),
  });

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bônus</h1>
          <p className="text-sm text-text-secondary">
            Snapshot mensal por vendedor/produto. Pagamento previsto no dia 20 do mês seguinte
            (RN-039). Após pago, o valor histórico é preservado (RN-041).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="input w-24"
            value={year}
            min={2020}
            max={2100}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <input
            type="number"
            className="input w-16"
            value={month}
            min={1}
            max={12}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RotateCw className="h-3.5 w-3.5" />
            {refresh.isPending ? 'Recalculando…' : 'Recalcular'}
          </button>
        </div>
      </header>

      <section className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Vendedor</th>
                <th className="px-4 py-2 text-left">Produto</th>
                <th className="px-4 py-2 text-right">Base</th>
                <th className="px-4 py-2 text-right">Valor apurado</th>
                <th className="px-4 py-2 text-right">Bônus</th>
                <th className="px-4 py-2 text-left">Previsto</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-secondary">
                    Sem apurações. Clique em "Recalcular".
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{row.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.product_id.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-right text-xs">
                    {row.metric_base === 'net_premium' ? 'Prêmio líquido' : 'Quantidade'}
                  </td>
                  <td className="px-4 py-2 text-right">{row.metric_value}</td>
                  <td className="px-4 py-2 text-right font-semibold">R$ {row.amount}</td>
                  <td className="px-4 py-2">
                    {new Date(row.predicted_on).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-2">
                    <StateBadge state={row.state} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {row.state === 'predicted' && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => approve.mutate(row.id)}
                          disabled={approve.isPending}
                        >
                          Aprovar
                        </button>
                      )}
                      {row.state !== 'paid' && row.state !== 'cancelled' && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => pay.mutate(row.id)}
                          disabled={pay.isPending}
                        >
                          <CheckCheck className="h-3.5 w-3.5" /> Marcar pago
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

      <section className="card p-5">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Trophy className="h-4 w-4 text-brand-orange" />
          Ao marcar como pago, o snapshot atual da regra e da métrica é congelado (RN-041).
        </div>
      </section>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    predicted: 'bg-brand-blue/20 text-brand-cyan',
    approved: 'bg-brand-cyan/20 text-brand-cyan',
    paid: 'bg-state-success/20 text-state-success',
    cancelled: 'bg-state-danger/20 text-state-danger',
  };
  return <span className={`badge ${map[state] ?? 'bg-surface-2'}`}>{state}</span>;
}
