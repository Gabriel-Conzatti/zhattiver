import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { opportunities, type Opportunity } from '@/lib/api';
import { OpportunityDrawer } from './OpportunityDrawer';

export function FunilPage() {
  const query = useQuery({
    queryKey: ['opportunities', 'mine', 'open'],
    queryFn: () => opportunities.list({ scope: 'mine', state: 'open' }),
  });
  const [selected, setSelected] = useState<string | null>(null);

  const items = query.data?.items ?? [];
  const stages = groupByStage(items);

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h1 className="text-lg font-semibold">Funil</h1>
        <p className="text-sm text-text-secondary">
          Clique em um card para abrir a oportunidade e registrar contatos, mudar etapa,
          criar próxima ação, marcar ganho ou perda (RN-023..RN-025).
        </p>
      </section>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {stages.map(([stageName, opps]) => (
          <section key={stageName} className="card p-3">
            <header className="mb-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {stageName} · {opps.length}
            </header>
            {opps.length === 0 ? (
              <div className="text-xs text-text-muted">Sem oportunidades.</div>
            ) : (
              <ul className="space-y-2">
                {opps.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(o.id)}
                      className="w-full rounded-lg border border-border bg-surface p-2 text-left text-xs transition hover:border-brand-cyan hover:bg-surface-2"
                    >
                      <div className="font-medium text-text-primary">{o.lead_name ?? '—'}</div>
                      <div className="mt-1 text-text-muted">
                        Última ação {new Date(o.last_relevant_at).toLocaleDateString('pt-BR')}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {selected && (
        <OpportunityDrawer opportunityId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function groupByStage(opps: Opportunity[]): Array<[string, Opportunity[]]> {
  const order = [
    'Mensagem inicial',
    'Questionário',
    'Negociação',
    'Reengajamento',
    'Finalização',
    'Transmitido',
  ];
  const map = new Map<string, Opportunity[]>();
  order.forEach((s) => map.set(s, []));
  for (const o of opps) {
    const key = o.stage_name ?? '—';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(o);
  }
  return Array.from(map.entries());
}
