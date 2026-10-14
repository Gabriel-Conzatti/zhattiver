import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, Megaphone, Target, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DashboardPanelMessage } from '@/components/DashboardUi';
import { bonusApi, opportunities, schedules } from '@/lib/api';

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

  const goals = goalsQuery.data;
  const active = schedulesQuery.data?.items ?? [];
  const items = [...active].slice(0, 5);
  const pendingFollowups = followupsQuery.data?.pending ?? [];
  const production = productionQuery.data;
  const bonus = bonusQuery.data;

  const metricCards: Array<{ label: string; done: number; target: number; tone: 'cyan' | 'blue' | 'orange' }> = [
    { label: 'Prospecção', done: goals?.prospecting.done ?? 0, target: goals?.prospecting.target ?? 0, tone: 'cyan' },
    { label: 'Agendamentos', done: goals?.schedules.done ?? 0, target: goals?.schedules.target ?? 0, tone: 'blue' },
    { label: 'Follow-ups', done: goals?.followups.done ?? 0, target: goals?.followups.target ?? 0, tone: 'orange' },
  ];

  return (
    <div className="rounded-[28px] border border-[#10263f] bg-[#071a2d] p-3 shadow-[0_30px_80px_rgba(2,12,24,0.65)] lg:p-4">
      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <section className="rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-4">
          <header className="mb-4 flex items-center justify-between gap-3 border-b border-[#17314d] pb-3">
            <div className="flex items-center gap-2 text-xl font-semibold text-white">
              <Calendar className="h-5 w-5 text-[#00CBFF]" />
              Agendamentos
            </div>
            <Link to="/agendamentos" className="rounded-lg bg-[#0f7fda] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#168ee8]">
              Ver agenda
            </Link>
          </header>

          <div className="overflow-x-auto rounded-[16px] border border-[#17314d] bg-[#071a2d]">
            <div className="grid min-w-[620px] grid-cols-[0.75fr_1.3fr_0.9fr_0.7fr_0.6fr] gap-2 border-b border-[#17314d] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7aa2c8]">
              <span>Data</span>
              <span>Nome</span>
              <span>Origem</span>
              <span>Contato</span>
              <span className="text-right">Ações</span>
            </div>
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
            ) : items.length === 0 ? (
              <div className="px-3 py-10 text-sm text-text-secondary">Nenhum agendamento exigível hoje.</div>
            ) : (
              items.map((schedule) => {
                const chipTone = schedule.view.past_contact_limit
                  ? 'bg-[#f59e0b]/15 text-[#fbbf24] border border-[#f59e0b]/25'
                  : 'bg-[#0ea5e9]/15 text-[#7dd3fc] border border-[#0ea5e9]/30';
                return (
                  <div key={schedule.id} className="grid min-w-[620px] grid-cols-[0.75fr_1.3fr_0.9fr_0.7fr_0.6fr] items-center gap-2 border-b border-[#17314d] px-3 py-3 last:border-b-0">
                    <div className="text-sm font-semibold text-white">{formatDate(schedule.coverage_end_date)}</div>
                    <div>
                      <div className="font-medium text-white">{schedule.lead_name ?? 'Lead sem nome'}</div>
                      <div className="text-[11px] text-[#7aa2c8]">{schedule.lead_phone ? schedule.lead_phone : 'Sem telefone'}</div>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold ${chipTone}`}>
                        {schedule.state === 'scheduled' ? 'Agendado' : schedule.view.label ?? 'Prospecção'}
                      </span>
                    </div>
                    <div className="text-sm text-[#b7d1eb]">{schedule.view.label ?? 'Hoje'}</div>
                    <div className="flex justify-end text-[#7dd3fc]">
                      <Link to="/agendamentos" aria-label={`Abrir agendamento de ${schedule.lead_name ?? 'lead sem nome'}`} className="rounded-md border border-[#16314d] p-1.5 hover:border-[#00CBFF] hover:text-white">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-semibold text-white">
                <Target className="h-4 w-4 text-[#00CBFF]" />
                Minhas metas de hoje
              </div>
            </div>
            {goalsQuery.isLoading ? (
              <DashboardPanelMessage kind="loading">Carregando metas de hoje…</DashboardPanelMessage>
            ) : goalsQuery.isError ? (
              <DashboardPanelMessage kind="error" onRetry={() => void goalsQuery.refetch()}>
                Não foi possível carregar as metas de hoje.
              </DashboardPanelMessage>
            ) : (
              <div className="space-y-3">
                {metricCards.map((metric) => (
                  <MetricBar key={metric.label} label={metric.label} done={metric.done} target={metric.target} tone={metric.tone} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-semibold text-white">
                <Trophy className="h-4 w-4 text-[#f7b701]" />
                Meta do mês
              </div>
            </div>
            {productionQuery.isLoading ? (
              <DashboardPanelMessage kind="loading">Carregando meta mensal…</DashboardPanelMessage>
            ) : productionQuery.isError ? (
              <DashboardPanelMessage kind="error" onRetry={() => void productionQuery.refetch()}>
                Não foi possível carregar a meta mensal.
              </DashboardPanelMessage>
            ) : production ? (
              <div className="space-y-3">
                <div className="rounded-[14px] border border-[#1b3045] bg-[#0b1e2e] p-3">
                  <div className="flex items-center justify-between text-xs text-[#a8c0d9]">
                    <span>Vendas</span>
                    <span className="font-semibold text-white">{production.count} / {production.goal.target_count ?? 0}</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#142a3d]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#00CBFF] to-[#2cc7ff]" style={{ width: `${Math.min(100, (Number(production.count ?? 0) / Math.max(1, Number(production.goal.target_count ?? 0))) * 100)}%` }} />
                  </div>
                </div>
                {bonusQuery.isError && (
                  <div className="text-xs text-[#fecaca]">Bônus temporariamente indisponível.</div>
                )}
                {bonus?.available && bonus.amount && (
                  <div className="rounded-[14px] border border-[#1c2e45] bg-[#0b1d2d] px-3 py-2 text-xs text-[#dfeeff]">
                    Bônus previsto: <span className="font-semibold text-white">R$ {bonus.amount}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-[14px] border border-dashed border-[#1b3045] bg-[#0b1d2d] p-3 text-sm text-[#9cb5cf]">
                A meta mensal ainda não foi configurada.
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="mt-4 rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-4">
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <Megaphone className="h-5 w-5 text-[#00CBFF]" />
            Follow-Ups pendentes
          </div>
          <Link to="/followups" className="text-xs font-medium text-[#7dd3fc] hover:text-white">Ver todos</Link>
        </header>
        {followupsQuery.isLoading ? (
          <DashboardPanelMessage kind="loading">Carregando follow-ups…</DashboardPanelMessage>
        ) : followupsQuery.isError ? (
          <DashboardPanelMessage kind="error" onRetry={() => void followupsQuery.refetch()}>
            Não foi possível carregar os follow-ups.
          </DashboardPanelMessage>
        ) : pendingFollowups.length === 0 ? (
          <EmptyState message="Nenhum follow-up pendente no momento." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendingFollowups.slice(0, 6).map((followup) => (
              <div key={followup.opportunity_id} className="rounded-[14px] border border-[#19304a] bg-[#091d2d] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{followup.lead_name ?? '—'}</div>
                    <div className="text-[11px] text-[#8aa7c4]">Última atualização {new Date(followup.last_relevant_at).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <Link to="/followups" aria-label={`Abrir follow-up de ${followup.lead_name ?? 'lead sem nome'}`} className="rounded-md border border-[#16314d] p-2 text-[#7dd3fc] hover:border-[#00CBFF] hover:text-white">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricBar({
  label,
  done,
  target,
  tone,
}: {
  label: string;
  done: number;
  target: number;
  tone: 'cyan' | 'blue' | 'orange';
}) {
  const value = target > 0 ? `${done}/${target}` : `${done}`;
  const pct = target > 0 ? Math.min(100, Math.max(0, (done / target) * 100)) : done > 0 ? 100 : 0;
  const palette = {
    cyan: 'from-[#00CBFF] to-[#38bdf8]',
    blue: 'from-[#0ea5e9] to-[#60a5fa]',
    orange: 'from-[#f7b701] to-[#f59e0b]',
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[13px] text-[#dcecff]">
        <span>{label}</span>
        <span className="font-semibold text-white">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#152b3d]">
        <div className={`h-full rounded-full bg-gradient-to-r ${palette[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-[14px] border border-dashed border-[#18314d] bg-[#0b1d2d] p-4 text-sm text-[#9bb2c9]">{message}</div>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
}
