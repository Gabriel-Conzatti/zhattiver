import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { admin, catalog } from '@/lib/api';

const current = new Date();

export function AdminRelatoriosPage() {
  const [year, setYear] = useState(current.getFullYear());
  const [month, setMonth] = useState(current.getMonth() + 1);
  const [sellerId, setSellerId] = useState('');
  const [productId, setProductId] = useState('');
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: admin.users });
  const products = useQuery({ queryKey: ['catalog', 'products'], queryFn: catalog.products });
  const report = useQuery({
    queryKey: ['admin', 'reports', 'production', year, month, sellerId, productId],
    queryFn: () =>
      admin.productionReport({
        year,
        month,
        seller_user_id: sellerId || undefined,
        product_id: productId || undefined,
      }),
  });
  const data = report.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-text-secondary">
          Produção oficial por vendedor e produto. Somente vendas validadas compõem os
          valores financeiros.
        </p>
      </header>

      <section className="card grid gap-4 p-4 md:grid-cols-4">
        <label className="label">
          Ano
          <input
            aria-label="Ano"
            className="input mt-1"
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </label>
        <label className="label">
          Mês
          <select
            aria-label="Mês"
            className="input mt-1"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
          >
            {MONTHS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Vendedor
          <select
            aria-label="Vendedor"
            className="input mt-1"
            value={sellerId}
            onChange={(event) => setSellerId(event.target.value)}
          >
            <option value="">Todos</option>
            {(users.data?.items ?? [])
              .filter((user) => user.role === 'vendedor')
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
        </label>
        <label className="label">
          Produto
          <select
            aria-label="Produto"
            className="input mt-1"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Todos</option>
            {(products.data?.items ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {report.isLoading && (
        <section className="card p-8 text-center text-text-secondary">Carregando relatório…</section>
      )}
      {report.isError && (
        <section role="alert" className="card border-state-danger p-6 text-state-danger">
          Não foi possível carregar o relatório. Tente novamente.
        </section>
      )}
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Vendas validadas" value={String(data.totals.validated_count)} />
            <MetricCard label="Prêmio líquido" value={money(data.totals.net_premium)} />
            <MetricCard label="Comissão" value={money(data.totals.commission_amount)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <StateCard label="Pendentes" value={data.state_counts.registered} />
            <StateCard label="Em revisão" value={data.state_counts.revision_pending} />
            <StateCard label="Validadas" value={data.state_counts.validated} />
            <StateCard label="Canceladas" value={data.state_counts.cancelled} />
          </div>
          <section className="card overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Vendedor</th>
                    <th className="px-4 py-3 text-left">Produto</th>
                    <th className="px-4 py-3 text-right">Vendas</th>
                    <th className="px-4 py-3 text-right">Prêmio líquido</th>
                    <th className="px-4 py-3 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-text-secondary">
                        Nenhuma venda validada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                  {data.items.map((item) => (
                    <tr
                      key={`${item.seller_user_id}:${item.product_id}`}
                      className="border-t border-border"
                    >
                      <td className="px-4 py-3">{item.seller_name}</td>
                      <td className="px-4 py-3">{item.product_name}</td>
                      <td className="px-4 py-3 text-right">{item.validated_count}</td>
                      <td className="px-4 py-3 text-right">{money(item.net_premium)}</td>
                      <td className="px-4 py-3 text-right">{money(item.commission_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="card p-5">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-text-secondary">{label}</div>
    </section>
  );
}

function StateCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="card-strong px-4 py-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-text-secondary">{label}</div>
    </section>
  );
}

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function money(value: string) {
  return moneyFormatter.format(Number(value));
}

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
