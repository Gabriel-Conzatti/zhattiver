import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { leads } from '@/lib/api';
import { formatPhone } from '@/lib/format';

export function AdminLeadsPage() {
  const [search, setSearch] = useState('');
  const [showArchived] = useState(false);
  const query = useQuery({
    queryKey: ['leads', 'admin', search],
    queryFn: () => leads.list({ q: search || undefined, per_page: 100 }),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Prospecção</h1>
          <p className="text-sm text-text-secondary">
            {total} lead{total === 1 ? '' : 's'} cadastrado{total === 1 ? '' : 's'} na organização
            {showArchived ? ' (incluindo arquivados)' : ''}.
          </p>
        </div>
        <input
          type="search"
          className="input w-72"
          placeholder="Buscar por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>
      <section className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Telefones</th>
                <th className="px-4 py-2 text-left">Cidade / UF</th>
                <th className="px-4 py-2 text-left">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-secondary">
                    Carregando…
                  </td>
                </tr>
              )}
              {!query.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-secondary">
                    Nenhum lead cadastrado ainda.
                  </td>
                </tr>
              )}
              {items.map((lead) => (
                <tr key={lead.id} className="border-t border-border">
                  <td className="px-4 py-2">{lead.name}</td>
                  <td className="px-4 py-2">
                    {lead.phones.map((p) => (
                      <div key={p} className="text-xs">
                        {formatPhone(p)}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">
                    {[lead.city, lead.state].filter(Boolean).join(' — ') || '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className="badge bg-brand-blue/20 text-brand-cyan">
                      {lead.kind === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
