import { useQuery } from '@tanstack/react-query';
import { Calendar, Headphones, Megaphone, Target, TrendingUp, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  const inWindow = active.filter((s) => s.view.in_window);
  const overdue = active.filter((s) => s.view.past_contact_limit);
  const pendingFollowups = followupsQuery.data?.pending ?? [];
  const production = productionQuery.data;
  const bonus = bonusQuery.data;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="card lg:col-span-2 p-5">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Calendar className="h-5 w-5 text-brand-cyan" /> Agendamentos exigíveis hoje
          </h2>
        </header>
        {schedulesQuery.isLoading && (
          <p className="text-sm text-text-secondary">Carregando…</p>
        )}
        {!schedulesQuery.isLoading && inWindow.length === 0 && overdue.length === 0 && (
          <EmptyState message="Sem agendamentos exigíveis hoje. 0/0 — Concluída (RN-015)." />
        )}
        {(inWindow.length > 0 || overdue.length > 0) && (
          <ul className="space-y-2">
            {[...overdue, ...inWindow].slice(0, 8).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{s.lead_name ?? '—'}</div>
                  <div className="text-xs text-text-muted">
                    Vigência {new Date(s.coverage_end_date).toLocaleDateString('pt-BR')}
                    {!s.date_confirmed && ' · data não confirmada'}
                  </div>
                </div>
                <span
                  className={`badge ${
                    s.view.past_contact_limit
                      ? 'bg-state-warning/20 text-state-warning'
                      : 'bg-brand-cyan/20 text-brand-cyan'
                  }`}
                >
                  {s.view.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="space-y-4">
        <section className="card p-5">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Target className="h-4 w-4 text-brand-cyan" /> Minhas metas de hoje
            </h3>
          </header>
          <MetricBar
            icon={<Megaphone className="h-4 w-4 text-brand-orange" />}
            label="Prospecção"
            done={goals?.prospecting.done ?? 0}
            target={goals?.prospecting.target ?? 0}
          />
          <MetricBar
            icon={<Calendar className="h-4 w-4 text-brand-cyan" />}
            label="Agendamentos"
            done={goals?.schedules.done ?? 0}
            target={goals?.schedules.target ?? 0}
          />
          <MetricBar
            icon={<Headphones className="h-4 w-4 text-brand-cyan" />}
            label="Follow-ups"
            done={goals?.followups.done ?? 0}
            target={goals?.followups.target ?? 0}
          />
          {goals && (
            <p className="mt-3 text-xs text-text-muted">
              Meta operacional fecha às {goals.closes_at_hour}h (RN-003).
            </p>
          )}
        </section>

        <section className="card p-5">
          <header className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-brand-orange" />
            <h3 className="text-base font-semibold">Meta do mês</h3>
          </header>
          {production ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Vendas validadas</span>
                <span className="font-semibold">
                  {production.count} / {production.goal.target_count || '—'}
                </span>
              </div>
              {production.net_premium !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Prêmio líquido</span>
                  <span className="font-semibold">R$ {production.net_premium}</span>
                </div>
              )}
              {bonus?.available && bonus.next_bracket && (
                <div className="rounded-lg border border-border bg-surface-2/50 p-2 text-xs">
                  Faltam <strong>{bonus.next_bracket.missing}</strong> para {bonus.next_bracket.name}
                </div>
              )}
              {bonus?.available && bonus.amount && (
                <div className="rounded-lg border border-brand-cyan/40 bg-brand-blue/10 p-2 text-xs">
                  Bônus previsto: <strong>R$ {bonus.amount}</strong> em {bonus.predicted_on}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Configuração administrativa pendente.</p>
          )}
        </section>

        <section className="card p-5">
          <header className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-cyan" />
            <h3 className="text-base font-semibold">Meu desempenho da semana</h3>
          </header>
          <div className="grid grid-cols-4 gap-2 text-center">
            {['Contatos', 'Agendamentos', 'Propostas', 'Ganhos'].map((label) => (
              <div key={label} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="text-xl font-semibold">—</div>
                <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="card lg:col-span-2 p-5">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Headphones className="h-5 w-5 text-brand-cyan" /> Follow-Ups pendentes
          </h2>
          <Link to="/followups" className="text-xs text-brand-cyan hover:underline">
            Ver todos
          </Link>
        </header>
        {pendingFollowups.length === 0 ? (
          <EmptyState message="Nenhum follow-up pendente. RN-016/017 verificados a cada acesso." />
        ) : (
          <ul className="space-y-2">
            {pendingFollowups.slice(0, 6).map((f) => (
              <li
                key={f.opportunity_id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{f.lead_name ?? '—'}</div>
                  <div className="text-xs text-text-muted">
                    Última atualização{' '}
                    {new Date(f.last_relevant_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <Link to="/followups" className="text-xs text-brand-cyan hover:underline">
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricBar({
  icon,
  label,
  done,
  target,
}: {
  icon: React.ReactNode;
  label: string;
  done: number;
  target: number;
}) {
  const pct = target > 0 ? (done / target) * 100 : done > 0 ? 100 : 0;
  const value = target > 0 ? `${done}/${target}` : `${done}/0 — Concluída`;
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-text-secondary">
          {icon} {label}
        </span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-gradient-to-r from-brand-cyan to-brand-blue"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-surface-2/40 py-10 text-center">
      <p className="max-w-md text-sm text-text-secondary">{message}</p>
    </div>
  );
}
