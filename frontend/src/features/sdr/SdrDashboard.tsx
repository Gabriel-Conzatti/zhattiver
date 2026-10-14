import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

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
      <Card label="Leads cadastrados" value={total} to="/sdr/prospeccao" />
      <Card label="Importações recentes" value={importsCount} to="/sdr/importacoes" />
      <Card label="Duplicidades no último lote" value={duplicateInLastBatch} to="/sdr/importacoes" />
      <section className="card md:col-span-3 p-5">
        <h2 className="text-lg font-semibold">Bem-vindo</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Cadastre e importe leads em <strong>Prospecção</strong> e{' '}
          <strong>Importações</strong>. Telefones equivalentes são reconhecidos para
          evitar duplicidades, e a administração é avisada quando um lead é disponibilizado.
        </p>
      </section>
    </div>
  );
}

function Card({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className="card p-5 transition hover:-translate-y-0.5 hover:border-brand-cyan/60 hover:shadow-glow"
    >
      <div className="text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-text-secondary">{label}</div>
      <div className="mt-3 text-xs text-brand-cyan">Abrir detalhes</div>
    </Link>
  );
}
