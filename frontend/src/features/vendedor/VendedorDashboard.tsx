import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Handshake,
  Megaphone,
  RefreshCw,
  Send,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { DashboardPanelMessage } from '@/components/DashboardUi';
import {
  Badge,
  DayCount,
  GoalBar,
  GoalGauge,
  PanelCard,
  StatTile,
  TableHead,
  formatDateBr,
  idleLabel,
  relativeDays,
} from '@/components/VendedorUi';
import { bonusApi, catalog, opportunities, schedules } from '@/lib/api';
import { formatPhone } from '@/lib/format';

const SCHEDULE_GRID = 'grid-cols-[72px_1.4fr_0.9fr_1fr_64px]';
const FOLLOWUP_GRID = 'grid-cols-[86px_1.5fr_1fr_64px]';

export function VendedorDashboard() {
  const goalsQuery = useQuery({ queryKey: ['me', 'goals'], queryFn: opportunities.myGoals });
  const schedulesQuery = useQuery({
    queryKey: ['schedules', 'mine'],
    queryFn: () => schedules.list({ scope: 'mine', filter: 'active' }),
  });
  const followupsQuery = useQuery({
    queryKey: ['me', 'followups'],
    queryFn: opportunities.myFollowups,
  });
  const productionQuery = useQuery({
    queryKey: ['me', 'production'],
    queryFn: () => bonusApi.myProduction(),
  });
  const bonusQuery = useQuery({ queryKey: ['me', 'bonus'], queryFn: () => bonusApi.myBonus() });
  const opportunitiesQuery = useQuery({
    queryKey: ['opportunities', 'mine', 'open'],
    queryFn: () => opportunities.list({ scope: 'mine', state: 'open' }),
  });
  const originsQuery = useQuery({ queryKey: ['catalog', 'origins'], queryFn: catalog.origins });

  const goals = goalsQuery.data;
  const originNames = new Map((originsQuery.data?.items ?? []).map((item) => [item.id, item.name]));
  const activeSchedules = schedulesQuery.data?.items ?? [];
  const nextSchedules = [...activeSchedules]
    .sort((a, b) => a.view.business_days_remaining - b.view.business_days_remaining)
    .slice(0, 6);
  const pendingFollowups = [...(followupsQuery.data?.pending ?? [])]
    .sort((a, b) => new Date(a.last_relevant_at).getTime() - new Date(b.last_relevant_at).getTime())
    .slice(0, 5);
  const production = productionQuery.data;
  const bonus = bonusQuery.data;
  const openOpportunities = opportunitiesQuery.data?.items ?? [];

  const monthlyTarget = Number(production?.goal.target_count ?? 0);
  const monthlyDone = Number(production?.count ?? 0);
  const missingSales = Math.max(0, monthlyTarget - monthlyDone);

  const negotiating = openOpportunities.filter((item) =>
    ['Negociação', 'Finalização'].includes(item.stage_name ?? ''),
  ).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.55fr_0.9fr]">
      <div className="min-w-0 space-y-4">
        <PanelCard
          title="Agendamentos"
          icon={Calendar}
          action={
            <Link
              to="/agendamentos"
              className="rounded-lg bg-[#0f7fda] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#168ee8]"
            >
              Ver agenda
            </Link>
          }
        >
          <div className="overflow-x-auto rounded-[16px] border border-[#132c45] bg-[#071a2d]">
            <div className="min-w-[640px]">
              <TableHead
                className={SCHEDULE_GRID}
                columns={['Dias', 'Nome', 'Origem', 'Vigência', 'Ações']}
              />
              {schedulesQuery.isLoading ? (
                <div className="p-3">
                  <DashboardPanelMessage kind="loading">Carregando agendamentos…</DashboardPanelMessage>
                </div>
              ) : schedulesQuery.isError ? (
                <div className="p-3">
                  <DashboardPanelMessage kind="error" onRetry={() => void schedulesQuery.refetch()}>
                    Não foi possível carregar os agendamentos.
                  </DashboardPanelMessage>
                </div>
              ) : nextSchedules.length === 0 ? (
                <p className="px-3 py-8 text-sm text-[#9bb2c9]">Nenhum agendamento ativo no momento.</p>
              ) : (
                nextSchedules.map((schedule) => {
                  const origin = schedule.origin_id ? originNames.get(schedule.origin_id) : null;
                  return (
                    <div
                      key={schedule.id}
                      className={`grid ${SCHEDULE_GRID} items-center gap-2 border-b border-[#132c45] px-3 py-3 last:border-b-0`}
                    >
                      <DayCount
                        days={schedule.view.business_days_remaining}
                        tone={
                          schedule.view.past_contact_limit
                            ? 'red'
                            : schedule.view.in_window
                              ? 'orange'
                              : 'cyan'
                        }
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-white">
                          {schedule.lead_name ?? 'Lead sem nome'}
                        </div>
                        <div className="text-[11px] text-[#7aa2c8]">
                          {schedule.lead_phone ? formatPhone(schedule.lead_phone) : 'Sem telefone'}
                        </div>
                      </div>
                      <div>
                        <Badge>{origin ?? 'Agendamento'}</Badge>
                      </div>
                      <div className="text-sm text-[#b7d1eb]">
                        {formatDateBr(schedule.coverage_end_date)}
                        <div className="text-[11px] text-[#7aa2c8]">{schedule.view.label}</div>
                      </div>
                      <div className="flex justify-end">
                        <Link
                          to="/agendamentos"
                          aria-label={`Abrir agendamento de ${schedule.lead_name ?? 'lead sem nome'}`}
                          className="rounded-md border border-[#16314d] p-1.5 text-[#7dd3fc] transition hover:border-[#00CBFF] hover:text-white"
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </PanelCard>

        <PanelCard
          title="Follow-ups"
          icon={RefreshCw}
          action={
            <Link to="/followups" className="text-xs font-semibold text-[#7dd3fc] transition hover:text-white">
              Ver detalhes →
            </Link>
          }
        >
          <div className="overflow-x-auto rounded-[16px] border border-[#132c45] bg-[#071a2d]">
            <div className="min-w-[560px]">
              <TableHead
                className={FOLLOWUP_GRID}
                columns={['Ociosidade', 'Nome', 'Última atualização', 'Ações']}
              />
              {followupsQuery.isLoading ? (
                <div className="p-3">
                  <DashboardPanelMessage kind="loading">Carregando follow-ups…</DashboardPanelMessage>
                </div>
              ) : followupsQuery.isError ? (
                <div className="p-3">
                  <DashboardPanelMessage kind="error" onRetry={() => void followupsQuery.refetch()}>
                    Não foi possível carregar os follow-ups.
                  </DashboardPanelMessage>
                </div>
              ) : pendingFollowups.length === 0 ? (
                <p className="px-3 py-8 text-sm text-[#9bb2c9]">Nenhum follow-up pendente no momento.</p>
              ) : (
                pendingFollowups.map((followup) => {
                  const idle = idleLabel(followup.last_relevant_at);
                  return (
                    <div
                      key={followup.opportunity_id}
                      className={`grid ${FOLLOWUP_GRID} items-center gap-2 border-b border-[#132c45] px-3 py-3 last:border-b-0`}
                    >
                      <Badge tone={idle.tone}>{idle.text}</Badge>
                      <div className="truncate font-medium text-white">{followup.lead_name ?? '—'}</div>
                      <div className="text-sm text-[#b7d1eb]">
                        {formatDateBr(followup.last_relevant_at)}
                        <div className="text-[11px] text-[#7aa2c8]">{relativeDays(followup.last_relevant_at)}</div>
                      </div>
                      <div className="flex justify-end">
                        <Link
                          to="/followups"
                          aria-label={`Atualizar follow-up de ${followup.lead_name ?? 'lead sem nome'}`}
                          className="rounded-md border border-[#16314d] p-1.5 text-[#7dd3fc] transition hover:border-[#00CBFF] hover:text-white"
                        >
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </PanelCard>
      </div>

      <aside className="min-w-0 space-y-4">
        <PanelCard title="Minhas metas de hoje" icon={Target}>
          {goalsQuery.isLoading ? (
            <DashboardPanelMessage kind="loading">Carregando metas de hoje…</DashboardPanelMessage>
          ) : goalsQuery.isError ? (
            <DashboardPanelMessage kind="error" onRetry={() => void goalsQuery.refetch()}>
              Não foi possível carregar as metas de hoje.
            </DashboardPanelMessage>
          ) : (
            <div className="space-y-4">
              <GoalBar
                label="Prospecção"
                icon={Megaphone}
                tone="cyan"
                done={goals?.prospecting.done ?? 0}
                target={goals?.prospecting.target ?? 0}
              />
              <GoalBar
                label="Agendamentos"
                icon={CalendarCheck}
                tone="blue"
                done={goals?.schedules.done ?? 0}
                target={goals?.schedules.target ?? 0}
              />
              <GoalBar
                label="Follow-ups"
                icon={RefreshCw}
                tone="orange"
                done={goals?.followups.done ?? 0}
                target={goals?.followups.target ?? 0}
              />
              <p className="text-[11px] text-[#7f9ab6]">
                A meta operacional do dia fecha às {goals?.closes_at_hour ?? 19}h.
              </p>
            </div>
          )}
        </PanelCard>

        <PanelCard title="Meta do mês" icon={Trophy} tone="amber">
          {productionQuery.isLoading ? (
            <DashboardPanelMessage kind="loading">Carregando meta mensal…</DashboardPanelMessage>
          ) : productionQuery.isError ? (
            <DashboardPanelMessage kind="error" onRetry={() => void productionQuery.refetch()}>
              Não foi possível carregar a meta mensal.
            </DashboardPanelMessage>
          ) : !production || monthlyTarget === 0 ? (
            <p className="rounded-[14px] border border-dashed border-[#18314d] bg-[#0b1d2d] p-3 text-sm text-[#9bb2c9]">
              A meta mensal ainda não foi configurada pela administração.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <GoalGauge current={monthlyDone} target={monthlyTarget} caption="Vendas no mês" />
              <div className="min-w-[128px] flex-1 space-y-2">
                <div className="rounded-[14px] border border-[#16314d] bg-[#0a2035] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-[0.1em] text-[#7f9ab6]">Faltam</div>
                  <div className="text-lg font-semibold text-white">
                    {missingSales} {missingSales === 1 ? 'venda' : 'vendas'}
                  </div>
                </div>
                {bonusQuery.isError ? (
                  <p className="text-[11px] text-[#fca5a5]">Bônus temporariamente indisponível.</p>
                ) : bonus?.available && bonus.next_bracket ? (
                  <div className="rounded-[14px] border border-[#16314d] bg-[#0a2035] px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.1em] text-[#7f9ab6]">Próxima faixa</div>
                    <div className="text-sm font-semibold text-white">{bonus.next_bracket.name}</div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </PanelCard>

        <PanelCard title="Meu desempenho" icon={Trophy} tone="green">
          {opportunitiesQuery.isError ? (
            <DashboardPanelMessage kind="error" onRetry={() => void opportunitiesQuery.refetch()}>
              Não foi possível carregar o desempenho.
            </DashboardPanelMessage>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                label="Oportunidades abertas"
                value={opportunitiesQuery.isLoading ? '—' : openOpportunities.length}
                icon={Users}
                tone="cyan"
              />
              <StatTile
                label="Agendamentos ativos"
                value={schedulesQuery.isLoading ? '—' : activeSchedules.length}
                icon={CalendarCheck}
                tone="blue"
              />
              <StatTile
                label="Em negociação"
                value={opportunitiesQuery.isLoading ? '—' : negotiating}
                icon={Handshake}
                tone="orange"
              />
              <StatTile
                label="Vendas no mês"
                value={productionQuery.isLoading ? '—' : monthlyDone}
                icon={CheckCircle2}
                tone="green"
              />
            </div>
          )}
        </PanelCard>
      </aside>
    </div>
  );
}
