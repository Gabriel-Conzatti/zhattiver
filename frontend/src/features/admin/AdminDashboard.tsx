import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { admin } from '@/lib/api';

export function AdminDashboard() {
  const query = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: admin.dashboard });
  const data = query.data;
  const cards = [
    { label: 'Leads cadastrados', value: data?.leads_total, to: '/admin/prospeccao' },
    { label: 'Oportunidades abertas', value: data?.open_opportunities },
    { label: 'Vendas pendentes', value: data?.pending_sales, to: '/admin/producao' },
    { label: 'Agendamentos ativos', value: data?.active_schedules },
    { label: 'Usuários ativos', value: data?.active_users, to: '/admin/equipe' },
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Painel administrativo</h1>
        <p className="text-sm text-text-secondary">
          Visão consolidada da operação. Detalhes por módulo estão nas seções laterais.
        </p>
      </header>
      {query.isError && (
        <div role="alert" className="rounded-xl border border-state-danger/30 bg-state-danger/10 p-4 text-sm text-state-danger">
          Não foi possível carregar os indicadores. Tente atualizar a página.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <DashboardCard key={c.label} {...c} />
        ))}
      </div>
    </div>
  );
}

function DashboardCard({
  label,
  value,
  to,
}: {
  label: string;
  value: number | undefined;
  to?: string;
}) {
  const content = (
    <>
      <div className="text-3xl font-semibold">{value ?? '—'}</div>
      <div className="mt-1 text-sm text-text-secondary">{label}</div>
      {to && <div className="mt-3 text-xs text-brand-cyan">Abrir detalhes</div>}
    </>
  );
  if (!to) return <section className="card p-5">{content}</section>;
  return (
    <Link
      to={to}
      className="card p-5 transition hover:-translate-y-0.5 hover:border-brand-cyan/60 hover:shadow-glow"
    >
      {content}
    </Link>
  );
}
