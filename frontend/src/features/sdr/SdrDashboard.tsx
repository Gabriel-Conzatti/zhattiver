import { useQuery } from '@tanstack/react-query';

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

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card label="Leads cadastrados" value={total} />
      <Card label="Importações recentes" value={importsCount} />
      <Card label="Duplicidades no último lote" value={duplicateInLastBatch} />
      <section className="card md:col-span-3 p-5">
        <h2 className="text-lg font-semibold">Bem-vindo</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Cadastre e importe leads em <strong>Prospecção</strong> e{' '}
          <strong>Importações</strong>. Duplicidades detectadas por telefone
          normalizado (RN-076/077). Ao disponibilizar, o admin recebe a notificação
          (RN-081 — a chegar na Etapa 7).
        </p>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <section className="card p-5">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-text-secondary">{label}</div>
    </section>
  );
}
