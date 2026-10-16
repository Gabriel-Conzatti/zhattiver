import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FolderCheck,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';

import { Badge, PageBanner, TableHead } from '@/components/VendedorUi';
import { claims } from '@/lib/api';
import { ClaimDialog } from './ClaimDialog';
import { NewClaimForm } from './NewClaimForm';
import { useCanManageClaims } from './SinistrosModule';
import { Message, errorMessage, formatDate, serviceTypeLabel } from './ui';

const PAGE_SIZE = 20;
const GRID = 'grid-cols-[1.4fr_1fr_1fr_1fr_0.8fr_0.9fr]';

export function SinistrosListPage({ state }: { state: 'open' | 'closed' }) {
  const canManage = useCanManageClaims();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const statusQuery = useQuery({ queryKey: ['claims', 'statuses'], queryFn: claims.statuses });
  const catalogQuery = useQuery({ queryKey: ['claims', 'catalogs'], queryFn: claims.catalogs });
  const assigneesQuery = useQuery({
    queryKey: ['claims', 'assignees'],
    queryFn: claims.assignees,
    enabled: canManage,
  });
  const listQuery = useQuery({
    queryKey: ['claims', 'list', state, q, status, page],
    queryFn: () =>
      claims.list({
        state,
        q: q || undefined,
        status: status || undefined,
        page,
        per_page: PAGE_SIZE,
      }),
  });
  const createMutation = useMutation({
    mutationFn: claims.create,
    onSuccess: async (claim) => {
      setShowForm(false);
      setSelected(claim.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['claims', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['claims', 'dashboard'] }),
      ]);
    },
  });

  const statuses = (statusQuery.data?.items ?? []).filter(
    (item) => item.is_terminal === (state === 'closed'),
  );
  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isOpen = state === 'open';

  return (
    <div className="space-y-4">
      <PageBanner
        icon={isOpen ? AlertTriangle : FolderCheck}
        title={isOpen ? 'Sinistros em aberto' : 'Sinistros fechados'}
        description={
          isOpen
            ? 'Clique em um sinistro para abrir o cadastro completo.'
            : 'Sinistros concluídos ou finalizados.'
        }
      >
        {canManage && isOpen && (
          <button
            type="button"
            className="btn-orange inline-flex items-center gap-2 rounded-xl"
            onClick={() => {
              createMutation.reset();
              setShowForm(true);
            }}
            disabled={
              catalogQuery.isLoading ||
              !catalogQuery.data?.branches.length ||
              !catalogQuery.data?.insurers.length
            }
          >
            <Plus className="h-4 w-4" /> Novo sinistro
          </button>
        )}
      </PageBanner>

      <section className="grid gap-2 rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-3 md:grid-cols-[minmax(240px,1fr)_220px_auto]">
        <label className="flex items-center gap-2 rounded-xl border border-[#18314d] bg-[#0b1d2d] px-3 py-2 text-sm text-[#9fb7cf]">
          <Search className="h-4 w-4" />
          <input
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar segurado, placa, seguradora ou número"
            className="w-full bg-transparent outline-none placeholder:text-[#68819b]"
            aria-label="Buscar sinistros"
          />
        </label>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="input"
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {statuses.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-button"
          aria-label="Atualizar sinistros"
          onClick={() => void listQuery.refetch()}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </section>

      {catalogQuery.isError && (
        <Message kind="error">Não foi possível carregar ramos, seguradoras e oficinas.</Message>
      )}

      {listQuery.isLoading ? (
        <Message>Carregando sinistros…</Message>
      ) : listQuery.isError ? (
        <Message kind="error">Não foi possível carregar os sinistros.</Message>
      ) : items.length === 0 ? (
        <Message>Nenhum sinistro encontrado para os filtros atuais.</Message>
      ) : (
        <section className="overflow-hidden rounded-[20px] border border-[#16314d] bg-[#081d30]">
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <TableHead
                className={GRID}
                columns={[
                  'Segurado',
                  'Status',
                  'Seguradora',
                  'Tipo de atendimento',
                  'Ramo',
                  'Acompanhamento',
                ]}
              />
              {items.map((claim) => (
                <button
                  key={claim.id}
                  type="button"
                  onClick={() => setSelected(claim.id)}
                  className={`grid w-full ${GRID} items-center gap-2 border-b border-[#132c45] px-3 py-3 text-left text-sm text-[#b7d1eb] transition last:border-b-0 hover:bg-[#0d2940]`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">
                      {claim.insured_name || 'Segurado não informado'}
                    </span>
                    <span className="block text-[11px] text-[#7aa2c8]">
                      {claim.claim_number || claim.vehicle_plate || 'Sem número'}
                    </span>
                  </span>
                  <span>
                    <Badge tone={claim.is_closed ? 'green' : 'cyan'}>
                      {claim.status_name || 'Sem status'}
                    </Badge>
                  </span>
                  <span className="truncate">{claim.insurer}</span>
                  <span className="truncate">{serviceTypeLabel(claim.service_type)}</span>
                  <span className="truncate">{claim.branch}</span>
                  <span>{claim.next_follow_up_on ? formatDate(claim.next_follow_up_on) : '—'}</span>
                </button>
              ))}
            </div>
          </div>
          <footer className="flex items-center justify-between border-t border-[#18314d] px-3 py-3 text-xs text-[#8faac4]">
            <span>
              {total} {total === 1 ? 'sinistro' : 'sinistros'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="icon-button"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                {page} de {totalPages}
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="Próxima página"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </section>
      )}

      {selected && <ClaimDialog claimId={selected} onClose={() => setSelected(null)} />}

      {showForm && catalogQuery.data && (
        <NewClaimForm
          catalogs={catalogQuery.data}
          users={assigneesQuery.data?.users ?? []}
          loading={createMutation.isPending}
          error={errorMessage(createMutation.error)}
          onClose={() => setShowForm(false)}
          onSubmit={(input) => createMutation.mutate(input)}
        />
      )}
    </div>
  );
}
