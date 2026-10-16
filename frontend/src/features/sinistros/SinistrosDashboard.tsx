import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarCheck, ClipboardList } from 'lucide-react';

import { DashboardMetricCard, DashboardPanelMessage } from '@/components/DashboardUi';
import { Badge, PanelCard, TableHead } from '@/components/VendedorUi';
import { claims } from '@/lib/api';
import { ClaimDialog } from './ClaimDialog';
import { formatDate } from './ui';

const GRID = 'grid-cols-[1.3fr_1.4fr_1fr_0.9fr]';

export function SinistrosDashboard() {
  const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['claims', 'dashboard'], queryFn: claims.dashboard });
  const data = query.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DashboardMetricCard
          label="Sinistros em aberto"
          value={data?.open_count}
          icon={AlertTriangle}
          loading={query.isLoading}
        />
        <DashboardMetricCard
          label="Acompanhamentos agendados para hoje"
          value={data?.today_count}
          icon={CalendarCheck}
          tone="orange"
          loading={query.isLoading}
        />
      </div>

      <PanelCard title="Acompanhamentos e pendências do dia" icon={ClipboardList}>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <TableHead className={GRID} columns={['Segurado', 'Acompanhamento', 'Seguradora', 'Data']} />
            {query.isLoading ? (
              <div className="p-3">
                <DashboardPanelMessage kind="loading">Carregando acompanhamentos…</DashboardPanelMessage>
              </div>
            ) : query.isError ? (
              <div className="p-3">
                <DashboardPanelMessage kind="error" onRetry={() => void query.refetch()}>
                  Não foi possível carregar os acompanhamentos.
                </DashboardPanelMessage>
              </div>
            ) : !data?.items.length ? (
              <p className="px-3 py-8 text-sm text-[#9bb2c9]">
                Nenhum acompanhamento ou pendência para hoje.
              </p>
            ) : (
              data.items.map((item) => (
                <button
                  key={item.task_id}
                  type="button"
                  onClick={() => setSelected(item.claim_id)}
                  className={`grid w-full ${GRID} items-center gap-2 border-b border-[#132c45] px-3 py-3 text-left text-sm text-[#b7d1eb] transition last:border-b-0 hover:bg-[#0d2940]`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">
                      {item.insured_name || 'Segurado não informado'}
                    </span>
                    <span className="block text-[11px] text-[#7aa2c8]">
                      {item.status_name ?? '—'}
                    </span>
                  </span>
                  <span className="truncate">{item.title}</span>
                  <span className="truncate">{item.insurer}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    {formatDate(item.due_on)}
                    {item.overdue && <Badge tone="red">Atrasado</Badge>}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </PanelCard>

      {selected && <ClaimDialog claimId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
