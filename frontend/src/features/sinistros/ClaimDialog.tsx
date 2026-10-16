import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, CirclePlus, ClipboardList, Pencil, UserRound } from 'lucide-react';

import { claims, type ClaimDetail, type ClaimPartyInput } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useCanManageClaims } from './SinistrosModule';
import {
  Info,
  Message,
  Modal,
  Panel,
  SmallEmpty,
  errorMessage,
  formatDate,
  formatDateTime,
  formatDocument,
  money,
  serviceTypeLabel,
  toDateTimeLocal,
} from './ui';

const PARTY_ROLES: Record<string, string> = {
  segurado: 'Segurado',
  terceiro: 'Terceiro',
  oficina: 'Oficina',
  outro: 'Outro',
};

export function ClaimDialog({ claimId, onClose }: { claimId: string; onClose: () => void }) {
  const canManage = useCanManageClaims();
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ['claims', 'detail', claimId],
    queryFn: () => claims.get(claimId),
  });
  const statusQuery = useQuery({ queryKey: ['claims', 'statuses'], queryFn: claims.statuses });
  const assigneesQuery = useQuery({
    queryKey: ['claims', 'assignees'],
    queryFn: claims.assignees,
    enabled: canManage,
  });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['claims', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['claims', 'dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['claims', 'detail', claimId] }),
    ]);
  }

  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: refresh,
  });
  const archiveMutation = useMutation({
    mutationFn: (reason: string) => claims.archive(claimId, reason),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  const run = (action: () => Promise<unknown>) => mutation.mutate(action);
  const busy = mutation.isPending || archiveMutation.isPending;
  const claim = detailQuery.data;

  return (
    <Modal
      title={claim ? claim.insured_name || 'Sinistro' : 'Sinistro'}
      description={
        claim
          ? `${claim.insurer} · ${claim.branch} · ${claim.claim_number || 'Número ainda não informado'}`
          : undefined
      }
      titleId="claim-detail-title"
      onClose={onClose}
      size="max-w-5xl"
    >
      {detailQuery.isLoading ? (
        <div className="mt-4">
          <Message>Carregando sinistro…</Message>
        </div>
      ) : detailQuery.isError || !claim ? (
        <div className="mt-4">
          <Message kind="error">Não foi possível carregar o sinistro.</Message>
        </div>
      ) : (
        <ClaimContent
          claim={claim}
          canManage={canManage}
          busy={busy}
          error={errorMessage(mutation.error ?? archiveMutation.error)}
          statuses={statusQuery.data?.items ?? []}
          users={assigneesQuery.data?.users ?? []}
          onStatus={(statusId) => run(() => claims.changeStatus(claimId, statusId))}
          onAssign={(userId) =>
            run(() => claims.assign(claimId, { responsible_user_id: userId }))
          }
          onEvent={(description, occurredAt) =>
            run(() => claims.addEvent(claimId, { description, occurred_at: occurredAt }))
          }
          onEventDate={(eventId, occurredAt) =>
            run(() => claims.updateEventDate(claimId, eventId, occurredAt))
          }
          onTask={(title, dueOn, priority) =>
            run(() => claims.addTask(claimId, { title, due_on: dueOn, priority }))
          }
          onTaskCompletion={(taskId, done) =>
            run(() => claims.updateTask(claimId, taskId, done))
          }
          onParty={(input) => run(() => claims.addParty(claimId, input))}
          onArchive={(reason) => archiveMutation.mutate(reason)}
        />
      )}
    </Modal>
  );
}

function ClaimContent({
  claim,
  canManage,
  busy,
  error,
  statuses,
  users,
  onStatus,
  onAssign,
  onEvent,
  onEventDate,
  onTask,
  onTaskCompletion,
  onParty,
  onArchive,
}: {
  claim: ClaimDetail;
  canManage: boolean;
  busy: boolean;
  error?: string;
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  onStatus: (statusId: string) => void;
  onAssign: (userId: string | null) => void;
  onEvent: (description: string, occurredAt: string) => void;
  onEventDate: (eventId: string, occurredAt: string) => void;
  onTask: (title: string, dueOn: string | undefined, priority: string) => void;
  onTaskCompletion: (taskId: string, done: boolean) => void;
  onParty: (input: ClaimPartyInput) => void;
  onArchive: (reason: string) => void;
}) {
  const [note, setNote] = useState('');
  const [noteAt, setNoteAt] = useState(() => toDateTimeLocal(new Date()));
  const [editingEvent, setEditingEvent] = useState<{ id: string; value: string } | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueOn, setTaskDueOn] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [party, setParty] = useState({ role: 'terceiro', name: '', document: '', phone: '' });
  const userNames = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);
  const insured = claim.parties.find((item) => item.role === 'segurado');

  return (
    <div className="mt-4 space-y-4">
      {error && <Message kind="error">{error}</Message>}

      {canManage && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[#9fb7cf]">
            Status
            <select
              value={claim.status_id}
              onChange={(event) => onStatus(event.target.value)}
              className="input mt-1 w-full"
              disabled={busy}
            >
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#9fb7cf]">
            Responsável
            <select
              value={claim.responsible_user_id ?? ''}
              onChange={(event) => onAssign(event.target.value || null)}
              className="input mt-1 w-full"
              disabled={busy}
            >
              <option value="">Sem responsável</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-[#18314d] bg-[#0b1d2d] p-3 text-sm text-[#b7cce0] sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Segurado" value={insured?.name ?? '—'} />
        <Info label="CPF/CNPJ" value={formatDocument(insured?.document ?? null)} />
        <Info label="Telefone" value={insured?.phone ? formatPhone(insured.phone) : '—'} />
        <Info label="Status" value={claim.status_name || '—'} />
        <Info label="Seguradora" value={claim.insurer} />
        <Info label="Ramo" value={claim.branch} />
        <Info label="Tipo de atendimento" value={serviceTypeLabel(claim.service_type)} />
        <Info label="Oficina" value={claim.workshop || '—'} />
        {(claim.vehicle_plate || claim.vehicle_model || claim.vehicle_year) && (
          <Info
            label="Veículo"
            value={[claim.vehicle_plate, claim.vehicle_model, claim.vehicle_year]
              .filter(Boolean)
              .join(' · ')}
          />
        )}
        {claim.property_address && <Info label="Endereço" value={claim.property_address} />}
        {claim.coverage && <Info label="Cobertura acionada" value={claim.coverage} />}
        <Info
          label="Responsável"
          value={
            claim.responsible_user_id
              ? userNames.get(claim.responsible_user_id) || 'Usuário atribuído'
              : 'Não atribuído'
          }
        />
        <Info label="Abertura" value={formatDate(claim.opened_on)} />
        <Info label="Conclusão" value={claim.concluded_on ? formatDate(claim.concluded_on) : '—'} />
        <Info label="Terceiro" value={claim.has_third_party ? 'Sim' : 'Não'} />
        {claim.indemnified_amount !== null && (
          <Info label="Valor indenizado" value={money(claim.indemnified_amount)} />
        )}
      </div>

      {claim.notes && (
        <p className="whitespace-pre-wrap rounded-xl bg-[#0b1d2d] p-3 text-sm text-[#b7cce0]">
          {claim.notes}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Participantes" icon={UserRound}>
          {claim.parties.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#18314d] p-2 text-sm">
              <div className="font-medium text-white">{item.name}</div>
              <div className="text-xs uppercase text-[#6f89a5]">
                {PARTY_ROLES[item.role] ?? item.role}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[#9fb7cf]">
                {item.document && <span>{formatDocument(item.document)}</span>}
                {item.phone && <span>{formatPhone(item.phone)}</span>}
              </div>
            </div>
          ))}
          {canManage && (
            <form
              className="grid gap-2 rounded-lg border border-[#18314d] p-2 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!party.name.trim()) return;
                onParty({
                  role: party.role,
                  name: party.name.trim(),
                  document: party.document.trim() || undefined,
                  phone: party.phone.trim() || undefined,
                });
                setParty({ ...party, name: '', document: '', phone: '' });
              }}
            >
              <select
                className="input"
                value={party.role}
                onChange={(event) => setParty({ ...party, role: event.target.value })}
                aria-label="Papel do participante"
              >
                {Object.entries(PARTY_ROLES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                value={party.name}
                onChange={(event) => setParty({ ...party, name: event.target.value })}
                placeholder="Nome do participante"
                aria-label="Nome do participante"
              />
              <input
                className="input"
                value={party.document}
                onChange={(event) => setParty({ ...party, document: event.target.value })}
                placeholder="CPF/CNPJ"
                aria-label="CPF/CNPJ do participante"
              />
              <div className="flex gap-2">
                <input
                  className="input"
                  value={party.phone}
                  onChange={(event) => setParty({ ...party, phone: event.target.value })}
                  placeholder="Telefone"
                  aria-label="Telefone do participante"
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy || !party.name.trim()}
                  aria-label="Adicionar participante"
                >
                  <CirclePlus className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </Panel>

        <Panel title="Acompanhamentos e pendências" icon={CheckCircle2}>
          {claim.tasks.length === 0 ? (
            <SmallEmpty>Nenhum acompanhamento agendado.</SmallEmpty>
          ) : (
            claim.tasks.map((task) => (
              <label
                key={task.id}
                className="flex gap-2 rounded-lg border border-[#18314d] p-2 text-sm text-[#b7cce0]"
              >
                <input
                  type="checkbox"
                  checked={Boolean(task.done_at)}
                  disabled={!canManage || busy}
                  onChange={(event) => onTaskCompletion(task.id, event.target.checked)}
                />
                <span className={task.done_at ? 'line-through opacity-60' : ''}>
                  {task.title}
                  {task.due_on && (
                    <span className="ml-2 text-xs text-[#6f89a5]">{formatDate(task.due_on)}</span>
                  )}
                </span>
              </label>
            ))
          )}
          {canManage && (
            <form
              className="grid gap-2 rounded-lg border border-[#18314d] p-2 sm:grid-cols-[1fr_140px_120px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                if (!taskTitle.trim()) return;
                onTask(taskTitle.trim(), taskDueOn || undefined, taskPriority);
                setTaskTitle('');
                setTaskDueOn('');
              }}
            >
              <input
                className="input"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Novo acompanhamento"
                aria-label="Novo acompanhamento"
              />
              <input
                className="input"
                type="date"
                value={taskDueOn}
                onChange={(event) => setTaskDueOn(event.target.value)}
                aria-label="Data do acompanhamento"
              />
              <select
                className="input"
                value={taskPriority}
                onChange={(event) => setTaskPriority(event.target.value)}
                aria-label="Prioridade do acompanhamento"
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </select>
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || !taskTitle.trim()}
                aria-label="Adicionar acompanhamento"
              >
                <CirclePlus className="h-4 w-4" />
              </button>
            </form>
          )}
        </Panel>
      </div>

      <Panel title="Histórico" icon={ClipboardList}>
        {claim.events.length === 0 ? (
          <SmallEmpty>Nenhum evento registrado.</SmallEmpty>
        ) : (
          claim.events.map((event) => (
            <div
              key={event.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[#18314d] p-2 text-sm text-[#9fb7cf]"
            >
              {editingEvent?.id === event.id ? (
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(submitEvent) => {
                    submitEvent.preventDefault();
                    onEventDate(event.id, new Date(editingEvent.value).toISOString());
                    setEditingEvent(null);
                  }}
                >
                  <input
                    type="datetime-local"
                    className="input w-auto"
                    value={editingEvent.value}
                    onChange={(change) =>
                      setEditingEvent({ id: event.id, value: change.target.value })
                    }
                    aria-label="Nova data da atualização"
                    required
                  />
                  <button type="submit" className="btn-primary" disabled={busy}>
                    Salvar data
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setEditingEvent(null)}
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <span className="text-[#6f89a5]">{formatDateTime(event.occurred_at)}</span>
              )}
              <span className="min-w-0 flex-1">{event.description}</span>
              {canManage && event.editable && editingEvent?.id !== event.id && (
                <button
                  type="button"
                  className="icon-button h-7 w-7"
                  aria-label="Ajustar data da atualização"
                  title="Ajustar data da atualização"
                  onClick={() =>
                    setEditingEvent({ id: event.id, value: toDateTimeLocal(event.occurred_at) })
                  }
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
        {canManage && (
          <form
            className="grid gap-2 sm:grid-cols-[1fr_200px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!note.trim() || !noteAt) return;
              onEvent(note.trim(), new Date(noteAt).toISOString());
              setNote('');
              setNoteAt(toDateTimeLocal(new Date()));
            }}
          >
            <input
              className="input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Registrar atualização"
              aria-label="Nova atualização"
            />
            <input
              type="datetime-local"
              className="input"
              value={noteAt}
              onChange={(event) => setNoteAt(event.target.value)}
              aria-label="Data da atualização"
              required
            />
            <button type="submit" className="btn-primary" disabled={busy || !note.trim()}>
              Registrar
            </button>
          </form>
        )}
      </Panel>

      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-ghost text-state-danger"
            disabled={busy}
            onClick={() => {
              const reason = window.prompt('Informe o motivo do arquivamento:');
              if (reason?.trim()) onArchive(reason.trim());
            }}
          >
            <Archive className="h-4 w-4" /> Arquivar
          </button>
        </div>
      )}
    </div>
  );
}
