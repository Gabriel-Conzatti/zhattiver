import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, Headphones } from 'lucide-react';

import { opportunities } from '@/lib/api';
import { OpportunityDrawer } from './OpportunityDrawer';

export function FollowupsPage() {
  const query = useQuery({ queryKey: ['me', 'followups'], queryFn: opportunities.myFollowups });
  const [selected, setSelected] = useState<string | null>(null);

  const pending = query.data?.pending ?? [];
  const nextActions = query.data?.next_actions ?? [];

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-blue/20">
            <Headphones className="h-5 w-5 text-brand-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Follow-ups</h1>
            <p className="text-sm text-text-secondary">
              24h corridas após a última atualização relevante + próximo dia útil (RN-016/017).
              Se há próxima ação programada, o follow-up automático é suprimido (RN-018).
            </p>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-4 py-2 text-sm font-semibold">
          <span>Follow-ups automáticos pendentes ({pending.length})</span>
          <span className="text-xs text-text-muted">Ordenados por última atualização</span>
        </header>
        {pending.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">
            Nenhum follow-up pendente. 0/0 — Concluída.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((row) => (
              <li key={row.opportunity_id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <div className="font-medium">{row.lead_name ?? '—'}</div>
                  <div className="text-xs text-text-muted">
                    Última atualização{' '}
                    {new Date(row.last_relevant_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setSelected(row.opportunity_id)}
                >
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm font-semibold">
          <AlarmClock className="h-4 w-4 text-brand-orange" /> Próximas ações programadas
        </header>
        {nextActions.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">Nenhuma ação programada.</p>
        ) : (
          <ul className="divide-y divide-border">
            {nextActions.map((na) => (
              <li
                key={na.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{na.type}</div>
                  <div className="text-xs text-text-muted">
                    {new Date(na.due_at).toLocaleString('pt-BR')} · {na.origin}
                  </div>
                  {na.notes && <div className="text-xs text-text-secondary">{na.notes}</div>}
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setSelected(na.opportunity_id)}
                >
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <OpportunityDrawer opportunityId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
