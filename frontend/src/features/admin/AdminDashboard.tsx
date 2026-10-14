import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  FileBarChart,
  Settings,
  Target,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  DashboardActionLink,
  DashboardMetricCard,
  DashboardPanelMessage,
} from '@/components/DashboardUi';
import { admin } from '@/lib/api';

export function AdminDashboard() {
  const query = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: admin.dashboard });
  const data = query.data;

  const cards = [
    { label: 'Leads cadastrados', value: data?.leads_total, to: '/admin/prospeccao', icon: Target, tone: 'cyan' as const },
    { label: 'Oportunidades abertas', value: data?.open_opportunities, icon: BarChart3, tone: 'blue' as const },
    { label: 'Vendas pendentes', value: data?.pending_sales, to: '/admin/producao', icon: CheckCheck, tone: 'orange' as const },
    { label: 'Agendamentos ativos', value: data?.active_schedules, icon: CalendarClock, tone: 'green' as const },
    { label: 'Usuários ativos', value: data?.active_users, to: '/admin/equipe', icon: Users, tone: 'purple' as const },
  ];

  return (
    <div className="rounded-[28px] border border-[#10263f] bg-[#071a2d] p-3 shadow-[0_30px_80px_rgba(2,12,24,0.65)] lg:p-4">
      <section className="mb-4 rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#17314d] bg-[#0d2439] text-[#00CBFF]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Painel administrativo</h2>
              <p className="text-sm text-[#9fb7cf]">Visão consolidada da operação e do pipeline.</p>
            </div>
          </div>

          <Link to="/admin/prospeccao" className="btn-orange rounded-xl text-sm">
            Gerenciar leads
          </Link>
        </div>

        {query.isError && (
          <div className="mt-4">
            <DashboardPanelMessage kind="error" onRetry={() => void query.refetch()}>
              Não foi possível carregar os indicadores administrativos.
            </DashboardPanelMessage>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <DashboardMetricCard key={card.label} {...card} loading={query.isLoading} />
          ))}
        </div>
      </section>

      <section className="rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-4">
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-white">Acessos rápidos</h3>
          <p className="text-sm text-[#8faac4]">Acompanhe e administre a operação pelos módulos existentes.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DashboardActionLink to="/admin/prospeccao" icon={Target} title="Prospecção" description="Cadastrar, revisar e disponibilizar leads." />
          <DashboardActionLink to="/admin/producao" icon={ClipboardList} title="Produção" description="Validar vendas e acompanhar pendências." />
          <DashboardActionLink to="/admin/relatorios" icon={FileBarChart} title="Relatórios" description="Consultar a produção consolidada." />
          <DashboardActionLink to="/admin/equipe" icon={UserRoundCheck} title="Equipe" description="Gerenciar usuários, metas e acessos." />
          <DashboardActionLink to="/admin/bonus" icon={CheckCheck} title="Metas e bônus" description="Configurar metas e acompanhar apurações." />
          <DashboardActionLink to="/admin/auditoria" icon={BarChart3} title="Auditoria" description="Consultar o histórico de ações relevantes." />
          <DashboardActionLink to="/admin/configuracoes" icon={Settings} title="Configurações" description="Manter funis, catálogos e regras operacionais." />
        </div>
      </section>
    </div>
  );
}
