import { useQuery } from '@tanstack/react-query';

import { admin } from '@/lib/api';

export function AdminDashboard() {
  const query = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: admin.dashboard });
  const data = query.data;
  const cards = [
    { label: 'Leads cadastrados', value: data?.leads_total },
    { label: 'Oportunidades abertas', value: data?.open_opportunities },
    { label: 'Vendas pendentes', value: data?.pending_sales },
    { label: 'Agendamentos ativos', value: data?.active_schedules },
    { label: 'Usuários ativos', value: data?.active_users },
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Painel administrativo</h1>
        <p className="text-sm text-text-secondary">
          Visão consolidada da operação. Detalhes por módulo estão nas seções laterais.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <section key={c.label} className="card p-5">
            <div className="text-3xl font-semibold">{c.value ?? '—'}</div>
            <div className="mt-1 text-sm text-text-secondary">{c.label}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
