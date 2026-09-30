import { useEffect, useMemo, useState } from 'react';
import { Copy, X } from 'lucide-react';

import { opportunities, type CopyMessageResponse } from '@/lib/api';
import { ApiRequestError } from '@/lib/http';

interface Props {
  leadId: string;
  leadName: string;
  productId: string;
  scheduleId?: string;
  origin?: string;
  onClose: () => void;
  onSuccess?: (result: CopyMessageResponse) => void;
}

function newIdempotencyKey(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now()}-${random}`;
}

export function CopyMessageDialog({
  leadId,
  leadName,
  productId,
  scheduleId,
  origin,
  onClose,
  onSuccess,
}: Props) {
  const idempotencyKey = useMemo(
    () => newIdempotencyKey(`${leadId}-${productId}${scheduleId ? '-' + scheduleId : ''}`),
    [leadId, productId, scheduleId],
  );
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; message: string; counted: boolean; reused: boolean }
    | { kind: 'error'; message: string }
    | { kind: 'copied'; message: string }
  >({ kind: 'loading' });

  const run = async () => {
    try {
      const result = await opportunities.copyMessage({
        lead_id: leadId,
        product_id: productId,
        idempotency_key: idempotencyKey,
        schedule_id: scheduleId,
        origin,
      });
      setState({
        kind: 'ready',
        message: result.opportunity.message ?? '',
        counted: result.counted,
        reused: result.reused,
      });
      onSuccess?.(result);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : (err as Error).message;
      setState({ kind: 'error', message: msg });
    }
  };

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCopy = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setState({ kind: 'copied', message });
    } catch {
      // Copiar falhou (ex.: permissão negada). Mantemos o registro; usuário pode
      // copiar manualmente.
      setState({ kind: 'copied', message });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg card-strong p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Mensagem inicial</h2>
            <p className="text-xs text-text-secondary">
              Cliente: <strong>{leadName}</strong>
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </header>

        {state.kind === 'loading' && (
          <p className="text-sm text-text-secondary">Preparando mensagem…</p>
        )}
        {state.kind === 'error' && (
          <div className="rounded-lg border border-state-danger/30 bg-state-danger/10 p-3 text-sm text-state-danger">
            {state.message}
          </div>
        )}
        {(state.kind === 'ready' || state.kind === 'copied') && (
          <>
            <pre className="max-h-64 whitespace-pre-wrap rounded-xl border border-border bg-surface p-3 text-sm">
              {state.message}
            </pre>
            {state.kind === 'ready' && (
              <div className="mt-3 text-xs text-text-secondary">
                {state.counted
                  ? 'Este contato conta para sua meta do dia (RN-006).'
                  : state.reused
                    ? 'Cópia repetida — já estava registrada.'
                    : 'Registro criado sem contagem para meta (RN-007).'}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {state.kind === 'ready' ? (
                <>
                  <button type="button" className="btn-ghost" onClick={onClose}>
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => doCopy(state.message)}
                  >
                    <Copy className="h-4 w-4" /> Copiar mensagem
                  </button>
                </>
              ) : (
                <button type="button" className="btn-primary" onClick={onClose}>
                  Concluído
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}