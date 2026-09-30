import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, MessageSquare, Phone, StickyNote, Reply, X } from 'lucide-react';

import { opportunities, type OpportunityDetail } from '@/lib/api';
import { SaleFormDialog } from './SaleFormDialog';

interface Props {
  opportunityId: string;
  onClose: () => void;
}

export function OpportunityDrawer({ opportunityId, onClose }: Props) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['opportunity', opportunityId],
    queryFn: () => opportunities.get(opportunityId),
  });
  const lossReasons = useQuery({ queryKey: ['loss-reasons'], queryFn: opportunities.lossReasons });
  const naTypes = useQuery({
    queryKey: ['next-action-types'],
    queryFn: opportunities.nextActionTypes,
  });

  const [dialog, setDialog] = useState<null | 'lose' | 'recycle' | 'next-action' | 'sale'>(null);
  const [text, setText] = useState('');

  const activity = useMutation({
    mutationFn: (type: 'contact' | 'call' | 'response' | 'note') =>
      opportunities.activity(opportunityId, {
        type,
        text: text.trim() || undefined,
        idempotency_key: newKey(type, opportunityId),
      }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      qc.invalidateQueries({ queryKey: ['me', 'goals'] });
      qc.invalidateQueries({ queryKey: ['me', 'followups'] });
    },
  });

  const stage = useMutation({
    mutationFn: (stage_id: string) => opportunities.changeStage(opportunityId, stage_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });

  const win = useMutation({
    mutationFn: () => opportunities.win(opportunityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      onClose();
    },
  });  const doneNextAction = useMutation({
    mutationFn: (id: string) => opportunities.markNextActionDone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] }),
  });

  const data = detail.data;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex justify-end bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl overflow-auto border-l border-border bg-base p-6">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-text-muted">Oportunidade</div>
            <h2 className="text-lg font-semibold">{data?.lead.name ?? '—'}</h2>
            <p className="text-xs text-text-secondary">
              Etapa atual: <strong>{data?.opportunity.stage_name ?? '—'}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        {detail.isLoading && <p className="text-sm text-text-secondary">Carregando…</p>}

        {data && (
          <>
            <section className="card p-4">
              <h3 className="mb-2 text-sm font-semibold">Registrar atividade</h3>
              <textarea
                className="input h-16"
                placeholder="Anotação opcional…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => activity.mutate('contact')}
                  disabled={activity.isPending}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Contato
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => activity.mutate('call')}
                  disabled={activity.isPending}
                >
                  <Phone className="h-3.5 w-3.5" /> Ligação
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => activity.mutate('response')}
                  disabled={activity.isPending}
                >
                  <Reply className="h-3.5 w-3.5" /> Resposta
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => activity.mutate('note')}
                  disabled={activity.isPending}
                >
                  <StickyNote className="h-3.5 w-3.5" /> Observação
                </button>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Registrar resposta não obriga a mudar de etapa (RN-024).
              </p>
            </section>

            <section className="card mt-4 p-4">
              <h3 className="mb-2 text-sm font-semibold">Mover para etapa</h3>
              <div className="flex flex-wrap gap-2">
                {data.stages.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`nav-pill-item ${s.id === data.opportunity.current_stage_id ? 'bg-brand-blue/20 text-text-primary' : ''}`}
                    onClick={() => stage.mutate(s.id)}
                    disabled={stage.isPending || s.id === data.opportunity.current_stage_id}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="card mt-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Próximas ações</h3>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setDialog('next-action')}
                  disabled={data.opportunity.state !== 'open'}
                >
                  <Clock className="h-3.5 w-3.5" /> Nova ação
                </button>
              </div>
              <ul className="mt-2 space-y-2">
                {data.next_actions.length === 0 && (
                  <li className="text-xs text-text-muted">Nenhuma ação programada.</li>
                )}
                {data.next_actions.map((na) => (
                  <li
                    key={na.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {na.type} · {new Date(na.due_at).toLocaleString('pt-BR')}
                      </div>
                      {na.notes && <div className="text-xs text-text-muted">{na.notes}</div>}
                      <div className="text-[10px] uppercase tracking-wide text-text-muted">
                        {na.origin} · {na.state}
                      </div>
                    </div>
                    {na.state === 'open' && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => doneNextAction.mutate(na.id)}
                        disabled={doneNextAction.isPending}
                      >
                        <Check className="h-3.5 w-3.5" /> Feita
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="card mt-4 p-4">
              <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
              <ul className="space-y-2 text-xs">
                {data.activities.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-border bg-surface-2/30 p-2"
                  >
                    <div className="font-medium text-text-primary">
                      {labelForActivity(a.type)}
                    </div>
                    <div className="text-text-muted">
                      {new Date(a.occurred_at).toLocaleString('pt-BR')}
                    </div>
                    {a.payload && renderPayload(a.payload)}
                  </li>
                ))}
                {data.activities.length === 0 && (
                  <li className="text-text-muted">Sem atividades ainda.</li>
                )}
              </ul>
            </section>

            <footer className="mt-4 flex flex-wrap justify-end gap-2">
              {data.opportunity.state === 'open' && (
                <>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setDialog('lose')}
                    disabled={win.isPending}
                  >
                    Perder
                  </button>
                  <button
                    type="button"
                    className="btn-orange"
                    onClick={() => setDialog('recycle')}
                  >
                    Reagendar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setDialog('sale')}
                    disabled={win.isPending}
                  >
                    Ganhar (registrar venda)
                  </button>
                </>
              )}
              {data.opportunity.state !== 'open' && (
                <button type="button" className="btn-primary" onClick={onClose}>
                  Fechar
                </button>
              )}
            </footer>
          </>
        )}

        {dialog === 'lose' && data && (
          <LoseDialog
            opportunityId={opportunityId}
            reasons={lossReasons.data?.items ?? []}
            onClose={() => setDialog(null)}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
              qc.invalidateQueries({ queryKey: ['opportunities'] });
              setDialog(null);
              onClose();
            }}
          />
        )}
        {dialog === 'recycle' && data && (
          <RecycleDialog
            opportunityId={opportunityId}
            onClose={() => setDialog(null)}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
              qc.invalidateQueries({ queryKey: ['schedules'] });
              setDialog(null);
              onClose();
            }}
          />
        )}
        {dialog === 'next-action' && data && (
          <NextActionDialog
            opportunityId={opportunityId}
            types={naTypes.data?.items ?? []}
            onClose={() => setDialog(null)}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
              setDialog(null);
            }}
          />
        )}
        {dialog === 'sale' && data && (
          <SaleFormDialog
            opportunityId={opportunityId}
            leadId={data.opportunity.lead_id}
            leadName={data.lead.name ?? undefined}
            productId={data.opportunity.product_id}
            onClose={() => setDialog(null)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
              qc.invalidateQueries({ queryKey: ['opportunities'] });
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

function labelForActivity(t: string): string {
  const map: Record<string, string> = {
    copy_message: 'Mensagem copiada (primeiro contato)',
    schedule_contact: 'Contato via agendamento',
    contact: 'Contato',
    call: 'Ligação',
    response: 'Resposta',
    note: 'Observação',
    stage_change: 'Mudança de etapa',
    next_action_created: 'Próxima ação criada',
    next_action_done: 'Próxima ação concluída',
    result: 'Resultado comercial',
  };
  return map[t] ?? t;
}

function renderPayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== '');
  if (entries.length === 0) return null;
  return (
    <ul className="mt-1 text-[11px] text-text-secondary">
      {entries.map(([k, v]) => (
        <li key={k}>
          <strong>{k}:</strong> {String(v)}
        </li>
      ))}
    </ul>
  );
}

function newKey(prefix: string, id: string): string {
  return `${prefix}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function LoseDialog({
  opportunityId,
  reasons,
  onClose,
  onDone,
}: {
  opportunityId: string;
  reasons: Array<{ id: string; name: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () =>
      opportunities.lose(opportunityId, { loss_reason_id: reason, justification }),
    onSuccess: onDone,
    onError: (err) => setError((err as Error).message),
  });
  return (
    <ModalShell title="Marcar como perdida" onClose={onClose}>
      <label className="label">Motivo</label>
      <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">Selecione…</option>
        {reasons.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <label className="label mt-3">Justificativa (obrigatória — RN-054)</label>
      <textarea
        className="input h-24"
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
      />
      {error && (
        <p className="mt-2 text-xs text-state-danger">{error}</p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-orange"
          disabled={!reason || justification.trim().length < 3 || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? 'Marcando…' : 'Marcar como perdida'}
        </button>
      </div>
    </ModalShell>
  );
}

function RecycleDialog({
  opportunityId,
  onClose,
  onDone,
}: {
  opportunityId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const suggested = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const [newDate, setNewDate] = useState(suggested);
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () =>
      opportunities.recycle(opportunityId, {
        new_date: newDate,
        notes: notes || undefined,
        date_confirmed: confirmed,
      }),
    onSuccess: onDone,
    onError: (err) => setError((err as Error).message),
  });
  return (
    <ModalShell title="Reagendar (reciclagem)" onClose={onClose}>
      <p className="text-xs text-text-secondary">
        Cria um novo agendamento vinculado ao lead. O histórico da tentativa atual é
        preservado (RN-059).
      </p>
      <label className="label mt-3">Nova data</label>
      <input
        type="date"
        className="input"
        value={newDate}
        onChange={(e) => setNewDate(e.target.value)}
      />
      <label className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Data confirmada
      </label>
      <label className="label mt-3">Observações</label>
      <textarea
        className="input h-20"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error && <p className="mt-2 text-xs text-state-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!newDate || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? 'Reagendando…' : 'Reagendar'}
        </button>
      </div>
    </ModalShell>
  );
}

function NextActionDialog({
  opportunityId,
  types,
  onClose,
  onDone,
}: {
  opportunityId: string;
  types: Array<{ id: string; name: string; slug: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const defaultType = types[0]?.slug ?? 'call';
  const [type, setType] = useState(defaultType);
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () =>
      opportunities.createNextAction(opportunityId, {
        type,
        due_at: new Date(dueAt).toISOString(),
        notes: notes || undefined,
      }),
    onSuccess: onDone,
    onError: (err) => setError((err as Error).message),
  });
  return (
    <ModalShell title="Nova próxima ação" onClose={onClose}>
      <label className="label">Tipo</label>
      <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
        {types.map((t) => (
          <option key={t.id} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
      <label className="label mt-3">Quando</label>
      <input
        type="datetime-local"
        className="input"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
      />
      <label className="label mt-3">Notas</label>
      <textarea className="input h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="mt-2 text-xs text-state-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!type || !dueAt || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? 'Salvando…' : 'Criar'}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md card-strong p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
