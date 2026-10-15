import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, User } from 'lucide-react';

import { DashboardPanelMessage } from '@/components/DashboardUi';
import { Badge, GoalStrip, PageBanner, TableHead, relativeDays } from '@/components/VendedorUi';
import { catalog, leads, opportunities } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { CopyMessageDialog } from './CopyMessageDialog';

const GRID = 'grid-cols-[104px_1.5fr_1fr_0.9fr_1fr]';
const selectClass =
  'rounded-lg border border-[#16314d] bg-[#0a2035] px-3 py-2 text-sm text-[#dcecff] outline-none transition focus:border-[#00CBFF]';

export function ProspeccaoPage() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<
    { leadId: string; leadName: string; productId: string } | null
  >(null);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [origin, setOrigin] = useState('');

  const query = useQuery({
    queryKey: ['availabilities'],
    queryFn: () => leads.availabilities({ per_page: 100 }),
  });
  const goalsQuery = useQuery({ queryKey: ['me', 'goals'], queryFn: opportunities.myGoals });
  const originsQuery = useQuery({ queryKey: ['catalog', 'origins'], queryFn: catalog.origins });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const originNames = new Map((originsQuery.data?.items ?? []).map((item) => [item.id, item.name]));

  const cities = useMemo(
    () => Array.from(new Set(items.map((row) => row.lead_city).filter(Boolean) as string[])).sort(),
    [items],
  );
  const availableOrigins = useMemo(
    () => Array.from(new Set(items.map((row) => row.origin_id).filter(Boolean) as string[])),
    [items],
  );

  const filtered = items.filter((row) => {
    const term = search.trim().toLowerCase();
    if (term && !row.lead_name.toLowerCase().includes(term) && !row.phones.some((p) => p.includes(term)))
      return false;
    if (city && row.lead_city !== city) return false;
    if (origin && row.origin_id !== origin) return false;
    return true;
  });

  const hasFilters = Boolean(search || city || origin);
  const goals = goalsQuery.data;

  return (
    <div className="space-y-4">
      <PageBanner
        icon={Megaphone}
        title="Prospecção"
        description="Encontre novas oportunidades e inicie contatos. Copiar a mensagem registra o primeiro contato."
      >
        {goalsQuery.isSuccess && (
          <GoalStrip
            label="Meta do dia"
            done={goals?.prospecting.done ?? 0}
            target={goals?.prospecting.target ?? 0}
          />
        )}
      </PageBanner>

      <section className="rounded-[20px] border border-[#16314d] bg-[#081d30] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou telefone"
            aria-label="Buscar lead disponível"
            className="min-w-[200px] flex-1 rounded-lg border border-[#16314d] bg-[#0a2035] px-3 py-2 text-sm text-[#dcecff] outline-none transition placeholder:text-[#6f8aa6] focus:border-[#00CBFF]"
          />
          <select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            aria-label="Filtrar por cidade"
            className={selectClass}
          >
            <option value="">Cidade</option>
            {cities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            aria-label="Filtrar por origem"
            className={selectClass}
          >
            <option value="">Origem</option>
            {availableOrigins.map((id) => (
              <option key={id} value={id}>
                {originNames.get(id) ?? 'Origem'}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCity('');
                setOrigin('');
              }}
              className="text-xs font-semibold text-[#7dd3fc] transition hover:text-white"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-[#16314d] bg-[#081d30]">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <TableHead
              className={GRID}
              columns={['Ação', 'Nome / contato', 'Cidade', 'Origem', 'Disponibilizado em']}
            />
            {query.isLoading ? (
              <div className="p-3">
                <DashboardPanelMessage kind="loading">Carregando leads disponíveis…</DashboardPanelMessage>
              </div>
            ) : query.isError ? (
              <div className="p-3">
                <DashboardPanelMessage kind="error" onRetry={() => void query.refetch()}>
                  Não foi possível carregar os leads disponíveis.
                </DashboardPanelMessage>
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-10 text-sm text-[#9bb2c9]">
                {hasFilters
                  ? 'Nenhum lead corresponde aos filtros aplicados.'
                  : 'Nenhum lead disponível para os seus produtos no momento.'}
              </p>
            ) : (
              filtered.map((row) => (
                <div
                  key={row.id}
                  className={`grid ${GRID} items-center gap-2 border-b border-[#132c45] px-3 py-3 last:border-b-0`}
                >
                  <div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#fb923c]"
                      onClick={() =>
                        setTarget({
                          leadId: row.lead_id,
                          leadName: row.lead_name,
                          productId: row.product_id,
                        })
                      }
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" /> Enviar
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate font-medium text-white">
                      <User className="h-4 w-4 shrink-0 text-[#00CBFF]" aria-hidden="true" />
                      <span className="truncate">{row.lead_name}</span>
                    </div>
                    <div className="text-[11px] text-[#7aa2c8]">
                      {row.phones[0] ? formatPhone(row.phones[0]) : 'Sem telefone'}
                    </div>
                  </div>
                  <div className="truncate text-sm text-[#b7d1eb]">
                    {[row.lead_city, row.lead_state].filter(Boolean).join(' — ') || '—'}
                  </div>
                  <div>
                    <Badge>{(row.origin_id && originNames.get(row.origin_id)) || 'Prospecção'}</Badge>
                  </div>
                  <div className="text-sm text-[#b7d1eb]">
                    {new Date(row.released_at).toLocaleDateString('pt-BR')}
                    <div className="text-[11px] text-[#7aa2c8]">{relativeDays(row.released_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {target && (
        <CopyMessageDialog
          leadId={target.leadId}
          leadName={target.leadName}
          productId={target.productId}
          onClose={() => setTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['availabilities'] });
            qc.invalidateQueries({ queryKey: ['me', 'goals'] });
            qc.invalidateQueries({ queryKey: ['opportunities'] });
          }}
        />
      )}
    </div>
  );
}
