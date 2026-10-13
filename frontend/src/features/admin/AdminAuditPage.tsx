import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';

import { admin } from '@/lib/api';

const PAGE_SIZE = 25;

export function AdminAuditPage() {
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    actor_user_id: '',
    entity_id: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'audit', page, appliedFilters],
    queryFn: () => admin.audit({ ...appliedFilters, page, per_page: PAGE_SIZE }),
  });
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  function applyFilters() {
    setPage(1);
    setAppliedFilters(filters);
  }

  function clearFilters() {
    const empty = { action: '', entity_type: '', actor_user_id: '', entity_id: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ClipboardList className="h-6 w-6 text-brand-cyan" /> Auditoria
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Histórico de ações relevantes da sua organização. Os registros são somente consulta.
        </p>
      </header>

      <section className="card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            className="input"
            placeholder="Ação, ex.: validate"
            value={filters.action}
            onChange={(event) => setFilters({ ...filters, action: event.target.value })}
          />
          <input
            className="input"
            placeholder="Entidade, ex.: sale"
            value={filters.entity_type}
            onChange={(event) => setFilters({ ...filters, entity_type: event.target.value })}
          />
          <input
            className="input"
            placeholder="ID do ator"
            value={filters.actor_user_id}
            onChange={(event) => setFilters({ ...filters, actor_user_id: event.target.value })}
          />
          <input
            className="input"
            placeholder="ID da entidade"
            value={filters.entity_id}
            onChange={(event) => setFilters({ ...filters, entity_id: event.target.value })}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn-primary" onClick={applyFilters}>
            Filtrar
          </button>
          <button type="button" className="btn-ghost" onClick={clearFilters}>
            Limpar
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        {query.isError ? (
          <p className="p-6 text-sm text-state-danger">
            Não foi possível carregar a auditoria. {(query.error as Error).message}
          </p>
        ) : (
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Data e hora</th>
                  <th className="px-4 py-2 text-left">Ação</th>
                  <th className="px-4 py-2 text-left">Entidade</th>
                  <th className="px-4 py-2 text-left">Ator</th>
                  <th className="px-4 py-2 text-left">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-text-secondary">Carregando…</td>
                  </tr>
                )}
                {!query.isLoading && query.data?.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-text-secondary">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
                {query.data?.items.map((entry) => (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-2">
                      {new Date(entry.occurred_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{entry.action}</td>
                    <td className="px-4 py-2">
                      <span>{entry.entity_type}</span>
                      {entry.entity_id && (
                        <span className="ml-2 font-mono text-xs text-text-muted">
                          {entry.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {entry.actor_user_id?.slice(0, 8) ?? 'Sistema'}
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{entry.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!query.isLoading && !query.isError && (query.data?.total ?? 0) > 0 && (
          <footer className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-text-secondary">
            <span>{query.data?.total} registro(s)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span>Página {page} de {totalPages}</span>
              <button
                type="button"
                className="btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
