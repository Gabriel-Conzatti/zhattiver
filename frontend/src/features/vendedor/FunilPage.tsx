import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Target } from 'lucide-react';

import { DashboardPanelMessage } from '@/components/DashboardUi';
import {
  Badge,
  GoalGauge,
  GoalStrip,
  PageBanner,
  relativeDays,
  type AccentTone,
} from '@/components/VendedorUi';
import { bonusApi, opportunities, type Opportunity } from '@/lib/api';
import { OpportunityDrawer } from './OpportunityDrawer';

const STAGE_ORDER = [
  'Mensagem inicial',
  'Questionário',
  'Negociação',
  'Reengajamento',
  'Finalização',
  'Transmitido',
];

const STAGE_TONES: Record<string, AccentTone> = {
  'Mensagem inicial': 'cyan',
  Questionário: 'blue',
  Negociação: 'orange',
  Reengajamento: 'purple',
  Finalização: 'amber',
  Transmitido: 'green',
};

const ORIGIN_LABELS: Record<string, string> = {
  schedule: 'Agendamento',
  prospecting: 'Prospecção',
  organic: 'Orgânico',
  referral: 'Indicação',
};

const stageAccent: Record<AccentTone, string> = {
  cyan: 'bg-[#00CBFF]',
  blue: 'bg-[#3b82f6]',
  orange: 'bg-[#f97316]',
  green: 'bg-[#22c55e]',
  red: 'bg-[#ef4444]',
  purple: 'bg-[#8b5cf6]',
  amber: 'bg-[#f59e0b]',
  pink: 'bg-[#ec4899]',
};

export function FunilPage() {
  const query = useQuery({
    queryKey: ['opportunities', 'mine', 'open'],
    queryFn: () => opportunities.list({ scope: 'mine', state: 'open' }),
  });
  const goalsQuery = useQuery({ queryKey: ['me', 'goals'], queryFn: opportunities.myGoals });
  const productionQuery = useQuery({
    queryKey: ['me', 'production'],
    queryFn: () => bonusApi.myProduction(),
  });
  const [selected, setSelected] = useState<string | null>(null);

  const items = query.data?.items ?? [];
  const stages = groupByStage(items);
  const goals = goalsQuery.data;
  const production = productionQuery.data;
  const monthlyTarget = Number(production?.goal.target_count ?? 0);
  const monthlyDone = Number(production?.count ?? 0);
  const missingSales = Math.max(0, monthlyTarget - monthlyDone);

  return (
    <div className="space-y-4">
      <PageBanner
        icon={Target}
        title="Funil"
        description="Abra um card para registrar contatos, mudar etapa, criar a próxima ação ou marcar ganho e perda."
      >
        {productionQuery.isSuccess && monthlyTarget > 0 && (
          <div className="flex items-center gap-3 rounded-[14px] border border-[#16314d] bg-[#0a2035] px-3 py-2">
            <GoalGauge current={monthlyDone} target={monthlyTarget} caption="Meta do mês" />
            <div>
              <div className="text-[11px] uppercase tracking-[0.1em] text-[#7f9ab6]">Faltam</div>
              <div className="text-lg font-semibold text-white">
                {missingSales} {missingSales === 1 ? 'venda' : 'vendas'}
              </div>
            </div>
          </div>
        )}
        {goalsQuery.isSuccess && (
          <GoalStrip
            label="Meta do dia"
            done={goals?.prospecting.done ?? 0}
            target={goals?.prospecting.target ?? 0}
          />
        )}
      </PageBanner>

      {query.isLoading ? (
        <DashboardPanelMessage kind="loading">Carregando o funil…</DashboardPanelMessage>
      ) : query.isError ? (
        <DashboardPanelMessage kind="error" onRetry={() => void query.refetch()}>
          Não foi possível carregar o funil.
        </DashboardPanelMessage>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stages.map(([stageName, opps]) => {
            const tone = STAGE_TONES[stageName] ?? 'cyan';
            return (
              <section
                key={stageName}
                className="min-w-0 overflow-hidden rounded-[18px] border border-[#16314d] bg-[#081d30]"
              >
                <div className={`h-1 w-full ${stageAccent[tone]}`} />
                <header className="flex items-center justify-between gap-2 border-b border-[#132c45] px-3 py-2">
                  <span className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a9c3da]">
                    {stageName}
                  </span>
                  <span className="rounded-md border border-[#16314d] bg-[#0a2035] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {opps.length}
                  </span>
                </header>
                <div className="space-y-2 p-2">
                  {opps.length === 0 ? (
                    <p className="px-1 py-4 text-[11px] text-[#7f9ab6]">Sem oportunidades.</p>
                  ) : (
                    opps.map((opportunity) => (
                      <button
                        key={opportunity.id}
                        type="button"
                        onClick={() => setSelected(opportunity.id)}
                        className="w-full rounded-[14px] border border-[#16314d] bg-[#0a2035] p-3 text-left transition hover:border-[#00CBFF]"
                      >
                        <div className="truncate text-sm font-semibold text-white">
                          {opportunity.lead_name ?? '—'}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge>
                            {(opportunity.origin && (ORIGIN_LABELS[opportunity.origin] ?? opportunity.origin)) ||
                              'Prospecção'}
                          </Badge>
                        </div>
                        <div className="mt-2 text-[11px] text-[#7aa2c8]">
                          {relativeDays(opportunity.last_relevant_at)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selected && (
        <OpportunityDrawer opportunityId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function groupByStage(opps: Opportunity[]): Array<[string, Opportunity[]]> {
  const map = new Map<string, Opportunity[]>();
  STAGE_ORDER.forEach((stage) => map.set(stage, []));
  for (const opportunity of opps) {
    const key = opportunity.stage_name ?? '—';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(opportunity);
  }
  return Array.from(map.entries());
}
