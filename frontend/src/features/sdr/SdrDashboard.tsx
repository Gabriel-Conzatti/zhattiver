import { useQuery } from '@tanstack/react-query';
import { CalendarRange, CirclePlus, FileUp, Megaphone, ShieldCheck, Target, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  DashboardActionLink,
  DashboardMetricCard,
  DashboardPanelMessage,
} from '@/components/DashboardUi';
import { importStatusLabel } from '@/features/imports/importStatus';
import { importsApi, leads } from '@/lib/api';

export function SdrDashboard() {
  const leadsQuery = useQuery({
    queryKey: ['leads', 'count'],
    queryFn: () => leads.list({ per_page: 1 }),
  });
  const importsQuery = useQuery({ queryKey: ['imports', 'summary'], queryFn: importsApi.list });

  const total = leadsQuery.data?.total ?? 0;
  const importsCount = importsQuery.data?.items.length ?? 0;
  const duplicateInLastBatch = importsQuery.data?.items[0]?.rows_duplicate ?? 0;
  const latestImport = importsQuery.data?.items[0];
  const hasError = leadsQuery.isError || importsQuery.isError;

  const cards = [
    {
      label: 'Leads cadastrados',
      value: leadsQuery.isError ? undefined : total,
      to: '/sdr/prospeccao',
      icon: Users,
      tone: 'cyan' as const,
      loading: leadsQuery.isLoading,
    },
    {
      label: 'Importações',
      value: importsQuery.isError ? undefined : importsCount,
      to: '/sdr/importacoes',
      icon: FileUp,
      tone: 'blue' as const,
      loading: importsQuery.isLoading,
    },
    {
      label: 'Duplicidades no último lote',
      value: importsQuery.isError ? undefined : duplicateInLastBatch,
      to: '/sdr/importacoes',
      icon: ShieldCheck,
      tone: 'orange' as const,
      loading: importsQuery.isLoading,
    },
  ];

  return (
    <div className="rounded-[28px] border border-[#10263f] bg-[#071a2d] p-3 shadow-[0_30px_80px_rgba(2,12,24,0.65)] lg:p-4">
      <section className="rounded-[20px] border border-[#1a2d40] bg-[#091d2d] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#17314d] bg-[#0d2237] text-[#00CBFF]">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Prospecção</h2>
              <p className="text-sm text-[#9fb7cf]">Encontre novas oportunidades e inicie contatos.</p>
            </div>
          </div>

          <Link to="/sdr/prospeccao" className="inline-flex items-center gap-2 rounded-xl bg-[#f59e0b] px-3 py-2 text-sm font-semibold text-[#051621]">
              <CirclePlus className="h-4 w-4" />
              Adicionar lead
          </Link>
        </div>

        {hasError && (
          <div className="mt-4">
            <DashboardPanelMessage
              kind="error"
              onRetry={() => {
                void leadsQuery.refetch();
                void importsQuery.refetch();
              }}
            >
              Não foi possível carregar o resumo da prospecção.
            </DashboardPanelMessage>
          </div>
        )}
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <DashboardMetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="mt-4 rounded-[20px] border border-[#1a2d40] bg-[#091d2d] p-4">
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-white">Operação do SDR</h3>
          <p className="text-sm text-[#8faac4]">Atalhos para os fluxos disponíveis ao perfil.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <DashboardActionLink to="/sdr/prospeccao" icon={Target} title="Prospecção" description="Cadastrar, revisar e disponibilizar leads." />
          <DashboardActionLink to="/sdr/agendamentos" icon={CalendarRange} title="Agendamentos" description="Acompanhar as datas cadastradas para os leads." />
          <DashboardActionLink to="/sdr/importacoes" icon={FileUp} title="Importações" description="Enviar planilhas e revisar duplicidades." />
        </div>

        <div className="mt-4 rounded-[16px] border border-[#19314d] bg-[#071c2d] p-3">
          <div className="mb-3 text-sm font-semibold text-white">Última importação</div>
          {importsQuery.isLoading ? (
            <DashboardPanelMessage kind="loading">Carregando histórico de importações…</DashboardPanelMessage>
          ) : importsQuery.isError ? (
            <DashboardPanelMessage kind="error" onRetry={() => void importsQuery.refetch()}>
              Não foi possível carregar o histórico de importações.
            </DashboardPanelMessage>
          ) : latestImport ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ImportDetail label="Arquivo" value={latestImport.filename} />
              <ImportDetail label="Linhas" value={String(latestImport.rows_total)} />
              <ImportDetail label="Duplicidades" value={String(latestImport.rows_duplicate)} />
              <ImportDetail label="Situação" value={importStatusLabel(latestImport.status)} />
            </div>
          ) : (
            <DashboardPanelMessage>Nenhuma importação realizada ainda.</DashboardPanelMessage>
          )}
        </div>
      </section>
    </div>
  );
}

function ImportDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#18314d] bg-[#0b1d2d] p-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[#8aa7c4]">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-white" title={value}>{value}</div>
    </div>
  );
}
