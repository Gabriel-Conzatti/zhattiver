import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, User } from 'lucide-react';

import { leads } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { CopyMessageDialog } from './CopyMessageDialog';

export function ProspeccaoPage() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<
    | { leadId: string; leadName: string; productId: string }
    | null
  >(null);
  const query = useQuery({
    queryKey: ['availabilities'],
    queryFn: () => leads.availabilities({ per_page: 100 }),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-blue/20">
              <Megaphone className="h-5 w-5 text-brand-cyan" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Prospecção</h1>
              <p className="text-sm text-text-secondary">
                Leads disponibilizados para os produtos aos quais você tem acesso (MP-001).
                "Copiar mensagem" registra o primeiro contato (RN-006).
              </p>
            </div>
          </div>
        </header>
      </section>

      <section className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Ação</th>
                <th className="px-4 py-2 text-left">Nome / contato</th>
                <th className="px-4 py-2 text-left">Cidade</th>
                <th className="px-4 py-2 text-left">Disponibilizado em</th>
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
                    Nenhum lead disponível para os seus produtos no momento.
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="btn-orange"
                      onClick={() =>
                        setTarget({
                          leadId: row.lead_id,
                          leadName: row.lead_name,
                          productId: row.product_id,
                        })
                      }
                    >
                      <Send className="h-3.5 w-3.5" /> Enviar
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-brand-cyan" /> {row.lead_name}
                    </div>
                    {row.phones[0] && (
                      <div className="text-xs text-text-muted">{formatPhone(row.phones[0])}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">
                    {[row.lead_city, row.lead_state].filter(Boolean).join(' — ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-text-muted">
                    {new Date(row.released_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
