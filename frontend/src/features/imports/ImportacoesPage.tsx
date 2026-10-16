import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileSpreadsheet, Trash2, UploadCloud } from 'lucide-react';

import { useAuth } from '@/app/AuthProvider';
import { importsApi, leads, type ImportBatchDetail } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { importStatusLabel } from './importStatus';

export function ImportacoesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const listQuery = useQuery({ queryKey: ['imports'], queryFn: importsApi.list });
  const detailQuery = useQuery({
    queryKey: ['imports', selectedBatch],
    queryFn: () => importsApi.get(selectedBatch!),
    enabled: !!selectedBatch,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => importsApi.upload(file),
    onSuccess: (data) => {
      setFeedback(`Lote ${data.id} recebido — revise as linhas antes de confirmar.`);
      setSelectedBatch(data.id);
      qc.invalidateQueries({ queryKey: ['imports'] });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => importsApi.confirm(id),
    onSuccess: (data) => {
      setFeedback(`Confirmado: ${data.created} leads criados, ${data.failed} pendências.`);
      qc.invalidateQueries({ queryKey: ['imports'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const discardMutation = useMutation({
    mutationFn: (id: string) => importsApi.discard(id),
    onSuccess: () => {
      setFeedback('Importação descartada. Nenhum lead foi criado.');
      qc.invalidateQueries({ queryKey: ['imports'] });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: (leadId: string) => leads.requestDeletion(leadId),
    onSuccess: () => {
      setFeedback('Lead excluído e enviado para avaliação do administrador.');
      qc.invalidateQueries({ queryKey: ['imports'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const batches = listQuery.data?.items ?? [];
  const detail = detailQuery.data;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UploadCloud className="h-5 w-5 text-brand-cyan" /> Nova importação
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Aceita CSV ou XLSX até 8 MiB. Cabeçalho mínimo: <code>nome</code> e{' '}
          <code>telefone</code>. Duplicidades são detectadas dentro do lote e contra o
          cadastro existente.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.currentTarget.value = '';
          }}
        />
        <button
          type="button"
          className="btn-primary mt-4 w-full"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? 'Enviando…' : 'Selecionar arquivo'}
        </button>
        {feedback && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-3 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-brand-cyan" />
            <span>{feedback}</span>
          </div>
        )}
        <h3 className="mt-6 text-sm font-semibold text-text-secondary">Últimos lotes</h3>
        <ul className="mt-2 space-y-1">
          {batches.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted">
              Nenhum lote ainda.
            </li>
          )}
          {batches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setSelectedBatch(b.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selectedBatch === b.id
                    ? 'border-brand-cyan bg-brand-blue/10'
                    : 'border-border hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-2 text-text-primary">
                  <FileSpreadsheet className="h-4 w-4 text-brand-cyan" />
                  <span className="truncate">{b.filename}</span>
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {b.rows_ok} ok · {b.rows_duplicate} duplicados · {b.rows_error} erros ·{' '}
                  {importStatusLabel(b.status)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Revisão do lote</h2>
          {detail?.status === 'reviewing' && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (window.confirm('Descartar esta importação? Nenhum lead será criado.')) {
                    discardMutation.mutate(detail.id);
                  }
                }}
                disabled={discardMutation.isPending || confirmMutation.isPending}
              >
                <Trash2 className="h-4 w-4" /> Descartar importação
              </button>
              <button
                type="button"
                className="btn-orange"
                onClick={() => confirmMutation.mutate(detail.id)}
                disabled={confirmMutation.isPending || discardMutation.isPending}
              >
                {confirmMutation.isPending ? 'Confirmando…' : 'Confirmar linhas OK'}
              </button>
            </div>
          )}
        </div>
        {detail?.status === 'confirmed' && (
          <p className="mt-1 text-xs text-text-secondary">
            Importação finalizada: exclua os leads indesejados um a um. As exclusões passam
            pela avaliação do administrador.
          </p>
        )}
        {!selectedBatch && (
          <div className="mt-6 rounded-xl border border-dashed border-border py-10 text-center text-sm text-text-secondary">
            Selecione um lote para ver detalhes.
          </div>
        )}
        {selectedBatch && detailQuery.isLoading && (
          <div className="mt-6 text-sm text-text-secondary">Carregando…</div>
        )}
        {detail && (
          <div className="mt-4 max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Linha</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Telefone</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Observação</th>
                  {detail.status === 'confirmed' && <th className="px-3 py-2 text-right">Lead</th>}
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 text-text-muted">{row.line_no}</td>
                    <td className="px-3 py-2">{row.payload?.['Nome'] ?? row.payload?.['nome'] ?? '—'}</td>
                    <td className="px-3 py-2">{row.payload?.['Telefone'] ?? row.payload?.['telefone'] ?? '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {(row.errors ?? []).join(' · ') || '—'}
                    </td>
                    {detail.status === 'confirmed' && (
                      <td className="px-3 py-2 text-right">
                        <ImportedLeadAction
                          row={row}
                          disabled={deleteLeadMutation.isPending}
                          onDelete={(leadId) => {
                            if (window.confirm('Excluir este lead importado?')) {
                              deleteLeadMutation.mutate(leadId);
                            }
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {user?.role === 'admin' && <DeletionReview />}
    </div>
  );
}

function ImportedLeadAction({
  row,
  disabled,
  onDelete,
}: {
  row: ImportBatchDetail['rows'][number];
  disabled: boolean;
  onDelete: (leadId: string) => void;
}) {
  if (!row.lead_id) return <span className="text-text-muted">—</span>;
  if (row.lead_state === 'deletion_pending') {
    return <span className="badge bg-state-warning/20 text-state-warning">Exclusão em avaliação</span>;
  }
  if (row.lead_state === 'archived') {
    return <span className="badge bg-surface-2 text-text-secondary">Arquivado</span>;
  }
  const leadId = row.lead_id;
  return (
    <button
      type="button"
      className="btn-ghost px-3 py-1 text-xs"
      disabled={disabled}
      onClick={() => onDelete(leadId)}
    >
      <Trash2 className="h-3.5 w-3.5" /> Excluir
    </button>
  );
}

function DeletionReview() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['leads', 'deletion-requests'], queryFn: leads.deletionRequests });
  const mutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      leads.reviewDeletion(id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['imports'] });
    },
  });
  const items = query.data?.items ?? [];

  return (
    <section className="card p-5 xl:col-span-2">
      <h2 className="text-lg font-semibold">Exclusões de leads para avaliar</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Leads excluídos pela equipe ficam arquivados até a sua decisão. Restaurar devolve o lead
        à prospecção.
      </p>
      {mutation.error instanceof Error && (
        <p className="mt-2 text-sm text-state-danger">{mutation.error.message}</p>
      )}
      {query.isLoading ? (
        <p className="mt-4 text-sm text-text-secondary">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border py-6 text-center text-sm text-text-secondary">
          Nenhuma exclusão pendente.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
              <div>
                <div className="font-medium">{item.lead_name}</div>
                <div className="text-xs text-text-muted">
                  {item.phones.map(formatPhone).join(', ') || 'Sem telefone'} · por{' '}
                  {item.requested_by_name} em {new Date(item.created_at).toLocaleString('pt-BR')}
                  {item.import_batch_id ? ' · importação' : ''}
                  {item.reason ? ` · ${item.reason}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost px-3 py-1 text-xs"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: item.id, decision: 'reject' })}
                >
                  Restaurar lead
                </button>
                <button
                  type="button"
                  className="btn-orange px-3 py-1 text-xs"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: item.id, decision: 'approve' })}
                >
                  Confirmar exclusão
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: 'ok' | 'duplicate' | 'error' | 'skipped' }) {
  const map: Record<string, string> = {
    ok: 'bg-state-success/20 text-state-success',
    duplicate: 'bg-state-warning/20 text-state-warning',
    error: 'bg-state-danger/20 text-state-danger',
    skipped: 'bg-surface-2 text-text-secondary',
  };
  const label: Record<string, string> = {
    ok: 'OK',
    duplicate: 'Duplicado',
    error: 'Erro',
    skipped: 'Ignorado',
  };
  return <span className={`badge ${map[status]}`}>{label[status]}</span>;
}
