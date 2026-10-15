import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  ClipboardList,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react';

import { useAuth } from '@/app/AuthProvider';
import {
  claims,
  type ClaimDetail,
  type ClaimListItem,
  type ClaimStatus,
} from '@/lib/api';

const PAGE_SIZE = 20;
type CreateClaimInput = Parameters<typeof claims.create>[0];

export function SinistrosPage({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage =
    !readOnly &&
    (user?.role === 'admin' || user?.grants.includes('claims.manage') === true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['claims', 'statuses'],
    queryFn: claims.statuses,
  });
  const listQuery = useQuery({
    queryKey: ['claims', 'list', q, status, overdue, page],
    queryFn: () =>
      claims.list({
        q: q || undefined,
        status: status || undefined,
        overdue,
        page,
        per_page: PAGE_SIZE,
      }),
  });
  const detailQuery = useQuery({
    queryKey: ['claims', 'detail', selected],
    queryFn: () => claims.get(selected as string),
    enabled: Boolean(selected),
  });
  const assigneesQuery = useQuery({
    queryKey: ['claims', 'assignees'],
    queryFn: claims.assignees,
    enabled: canManage,
  });

  async function refreshClaims(claimId?: string) {
    await queryClient.invalidateQueries({ queryKey: ['claims', 'list'] });
    if (claimId) {
      await queryClient.invalidateQueries({ queryKey: ['claims', 'detail', claimId] });
    }
  }

  const createMutation = useMutation({
    mutationFn: claims.create,
    onSuccess: async (claim) => {
      setShowForm(false);
      setSelected(claim.id);
      await refreshClaims(claim.id);
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, statusId }: { id: string; statusId: string }) =>
      claims.changeStatus(id, statusId),
    onSuccess: (_, variables) => refreshClaims(variables.id),
  });
  const partyMutation = useMutation({
    mutationFn: ({
      id,
      role,
      name,
      phone,
    }: {
      id: string;
      role: string;
      name: string;
      phone?: string;
    }) => claims.addParty(id, { role, name, phone }),
    onSuccess: (_, variables) => refreshClaims(variables.id),
  });
  const assignmentMutation = useMutation({
    mutationFn: ({
      id,
      responsibleUserId,
      teamId,
    }: {
      id: string;
      responsibleUserId: string | null;
      teamId: string | null;
    }) =>
      claims.assign(id, {
        responsible_user_id: responsibleUserId,
        team_id: teamId,
      }),
    onSuccess: (_, variables) => refreshClaims(variables.id),
  });
  const eventMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      claims.addEvent(id, description),
    onSuccess: (_, variables) => refreshClaims(variables.id),
  });
  const taskMutation = useMutation({
    mutationFn: ({
      id,
      title,
      dueOn,
      priority,
    }: {
      id: string;
      title: string;
      dueOn?: string;
      priority: string;
    }) => claims.addTask(id, { title, due_on: dueOn, priority }),
    onSuccess: (_, variables) => refreshClaims(variables.id),
  });
  const taskCompletionMutation = useMutation({
    mutationFn: ({
      claimId,
      taskId,
      done,
    }: {
      claimId: string;
      taskId: string;
      done: boolean;
    }) => claims.updateTask(claimId, taskId, done),
    onSuccess: (_, variables) => refreshClaims(variables.claimId),
  });
  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      claims.archive(id, reason),
    onSuccess: async () => {
      setSelected(null);
      await refreshClaims();
    },
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actionError =
    statusMutation.error ??
    assignmentMutation.error ??
    eventMutation.error ??
    taskMutation.error ??
    partyMutation.error ??
    taskCompletionMutation.error ??
    archiveMutation.error;

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#00CBFF]">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                Operação
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Sinistros</h1>
            <p className="mt-1 text-sm text-[#9fb7cf]">
              Acompanhe seguradoras, terceiros, pendências e prazos em um só lugar.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              className="btn-orange inline-flex items-center gap-2 rounded-xl"
              onClick={() => setShowForm(true)}
              disabled={statusQuery.isLoading || !statusQuery.data?.items.length}
            >
              <Plus className="h-4 w-4" /> Novo sinistro
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(240px,1fr)_220px_auto_auto]">
          <label className="flex items-center gap-2 rounded-xl border border-[#18314d] bg-[#0b1d2d] px-3 py-2 text-sm text-[#9fb7cf]">
            <Search className="h-4 w-4" />
            <input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar seguradora, ramo ou número"
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
            {statusQuery.data?.items.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-[#18314d] bg-[#0b1d2d] px-3 text-sm text-[#9fb7cf]">
            <input
              type="checkbox"
              checked={overdue}
              onChange={(event) => {
                setOverdue(event.target.checked);
                setPage(1);
              }}
            />
            Atrasados
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label="Atualizar sinistros"
            onClick={() => void listQuery.refetch()}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </section>

      {listQuery.isLoading ? (
        <Message>Carregando sinistros…</Message>
      ) : listQuery.isError ? (
        <Message kind="error">Não foi possível carregar os sinistros.</Message>
      ) : items.length === 0 ? (
        <Message>Nenhum sinistro encontrado para os filtros atuais.</Message>
      ) : (
        <section className="rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-3">
          <div className="grid gap-2">
            {items.map((claim) => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                selected={selected === claim.id}
                onSelect={() => setSelected(claim.id)}
              />
            ))}
          </div>
          <footer className="mt-3 flex items-center justify-between border-t border-[#18314d] pt-3 text-xs text-[#8faac4]">
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

      {selected && (
        <ClaimDetails
          claim={detailQuery.data}
          loading={detailQuery.isLoading}
          error={detailQuery.isError ? 'Não foi possível carregar o sinistro.' : undefined}
          actionError={actionError instanceof Error ? actionError.message : undefined}
          canManage={canManage}
          statuses={statusQuery.data?.items ?? []}
          assignees={assigneesQuery.data}
          busy={
            statusMutation.isPending ||
            assignmentMutation.isPending ||
            eventMutation.isPending ||
            taskMutation.isPending ||
            partyMutation.isPending ||
            taskCompletionMutation.isPending ||
            archiveMutation.isPending
          }
          onClose={() => setSelected(null)}
          onStatus={(statusId) => statusMutation.mutate({ id: selected, statusId })}
          onAssign={(responsibleUserId, teamId) =>
            assignmentMutation.mutate({
              id: selected,
              responsibleUserId,
              teamId,
            })
          }
          onEvent={(description) => eventMutation.mutate({ id: selected, description })}
          onTask={(title, dueOn, priority) =>
            taskMutation.mutate({ id: selected, title, dueOn, priority })
          }
          onParty={(role, name, phone) =>
            partyMutation.mutate({ id: selected, role, name, phone })
          }
          onTaskCompletion={(taskId, done) =>
            taskCompletionMutation.mutate({ claimId: selected, taskId, done })
          }
          onArchive={(reason) => archiveMutation.mutate({ id: selected, reason })}
        />
      )}

      {showForm && (
        <NewClaimForm
          statuses={statusQuery.data?.items ?? []}
          assignees={assigneesQuery.data}
          loading={createMutation.isPending}
          error={createMutation.error instanceof Error ? createMutation.error.message : undefined}
          onClose={() => setShowForm(false)}
          onSubmit={(input) => createMutation.mutate(input)}
        />
      )}
    </div>
  );
}

function ClaimRow({
  claim,
  selected,
  onSelect,
}: {
  claim: ClaimListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const isOverdue =
    Boolean(claim.expected_on) &&
    !claim.concluded_on &&
    new Date(`${claim.expected_on}T23:59:59`) < new Date();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid gap-2 rounded-xl border p-3 text-left transition sm:grid-cols-[1fr_auto] ${
        selected
          ? 'border-[#00CBFF] bg-[#0d2940]'
          : 'border-[#18314d] bg-[#0b1d2d] hover:border-[#00CBFF]/60'
      }`}
    >
      <div>
        <div className="font-medium text-white">
          {claim.insurer} · {claim.branch}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#8faac4]">
          <span>{claim.claim_number || 'Sem número'}</span>
          <span>Abertura {formatDate(claim.opened_on)}</span>
          {claim.expected_on && (
            <span className={isOverdue ? 'text-[#fca5a5]' : ''}>
              Previsão {formatDate(claim.expected_on)}
            </span>
          )}
        </div>
      </div>
      <span className="self-start rounded-full border border-[#00CBFF]/30 px-2 py-1 text-xs text-[#7dd3fc]">
        {claim.status_name || 'Sem status'}
      </span>
    </button>
  );
}

interface ClaimDetailsProps {
  claim?: ClaimDetail;
  loading: boolean;
  error?: string;
  actionError?: string;
  canManage: boolean;
  statuses: ClaimStatus[];
  assignees?: {
    users: Array<{ id: string; name: string }>;
    teams: Array<{ id: string; name: string }>;
  };
  busy: boolean;
  onClose: () => void;
  onStatus: (statusId: string) => void;
  onAssign: (responsibleUserId: string | null, teamId: string | null) => void;
  onEvent: (description: string) => void;
  onTask: (title: string, dueOn: string | undefined, priority: string) => void;
  onParty: (role: string, name: string, phone: string | undefined) => void;
  onTaskCompletion: (taskId: string, done: boolean) => void;
  onArchive: (reason: string) => void;
}

function ClaimDetails({
  claim,
  loading,
  error,
  actionError,
  canManage,
  statuses,
  assignees,
  busy,
  onClose,
  onStatus,
  onAssign,
  onEvent,
  onTask,
  onParty,
  onTaskCompletion,
  onArchive,
}: ClaimDetailsProps) {
  const [note, setNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueOn, setTaskDueOn] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [partyRole, setPartyRole] = useState('segurado');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const userNames = useMemo(
    () => new Map(assignees?.users.map((user) => [user.id, user.name]) ?? []),
    [assignees],
  );

  if (loading) return <Message>Carregando detalhes…</Message>;
  if (error || !claim) return <Message kind="error">{error || 'Sinistro indisponível.'}</Message>;

  return (
    <section className="rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {claim.insurer} · {claim.branch}
          </h2>
          <p className="text-sm text-[#8faac4]">
            {claim.claim_number || 'Número ainda não informado'}
          </p>
        </div>
        <button type="button" className="icon-button" aria-label="Fechar detalhes" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {actionError && <Message kind="error">{actionError}</Message>}

      {canManage && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
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
              onChange={(event) =>
                onAssign(event.target.value || null, claim.team_id)
              }
              className="input mt-1 w-full"
              disabled={busy}
            >
              <option value="">Sem responsável</option>
              {assignees?.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#9fb7cf]">
            Equipe
            <select
              value={claim.team_id ?? ''}
              onChange={(event) =>
                onAssign(claim.responsible_user_id, event.target.value || null)
              }
              className="input mt-1 w-full"
              disabled={busy}
            >
              <option value="">Sem equipe</option>
              {assignees?.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="mt-4 grid gap-3 text-sm text-[#b7cce0] sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Atendimento" value={claim.service_type || '—'} />
        <Info label="Oficina" value={claim.workshop || '—'} />
        <Info label="Abertura" value={formatDate(claim.opened_on)} />
        <Info label="Previsão" value={claim.expected_on ? formatDate(claim.expected_on) : '—'} />
        <Info
          label="Responsável"
          value={
            claim.responsible_user_id
              ? userNames.get(claim.responsible_user_id) || 'Usuário atribuído'
              : 'Não atribuído'
          }
        />
        <Info label="Terceiro" value={claim.has_third_party ? 'Sim' : 'Não'} />
        {claim.indemnified_amount !== null && (
          <Info label="Valor indenizado" value={money(claim.indemnified_amount)} />
        )}
        <Info
          label="Conclusão"
          value={claim.concluded_on ? formatDate(claim.concluded_on) : '—'}
        />
      </div>

      {claim.notes && (
        <p className="mt-4 rounded-xl bg-[#0b1d2d] p-3 text-sm text-[#b7cce0]">
          {claim.notes}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title="Participantes" icon={UserRound}>
          {claim.parties.length === 0 ? (
            <SmallEmpty>Nenhum participante cadastrado.</SmallEmpty>
          ) : (
            claim.parties.map((party) => (
              <div key={party.id} className="rounded-lg border border-[#18314d] p-2 text-sm">
                <div className="font-medium text-white">{party.name}</div>
                <div className="text-xs uppercase text-[#6f89a5]">{party.role}</div>
                {party.phone && <div className="mt-1 text-[#9fb7cf]">{party.phone}</div>}
              </div>
            ))
          )}
          {canManage && (
            <form
              className="grid gap-2 rounded-lg border border-[#18314d] p-2 sm:grid-cols-[120px_1fr_150px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                if (!partyName.trim()) return;
                onParty(
                  partyRole,
                  partyName.trim(),
                  partyPhone.trim() || undefined,
                );
                setPartyName('');
                setPartyPhone('');
              }}
            >
              <select
                className="input"
                value={partyRole}
                onChange={(event) => setPartyRole(event.target.value)}
                aria-label="Papel do participante"
              >
                <option value="segurado">Segurado</option>
                <option value="terceiro">Terceiro</option>
                <option value="oficina">Oficina</option>
                <option value="outro">Outro</option>
              </select>
              <input
                className="input"
                value={partyName}
                onChange={(event) => setPartyName(event.target.value)}
                placeholder="Nome do participante"
                aria-label="Nome do participante"
              />
              <input
                className="input"
                value={partyPhone}
                onChange={(event) => setPartyPhone(event.target.value)}
                placeholder="Telefone"
                aria-label="Telefone do participante"
              />
              <button type="submit" className="btn-primary" disabled={busy || !partyName.trim()}>
                <CirclePlus className="h-4 w-4" />
              </button>
            </form>
          )}
        </Panel>

        <Panel title="Tarefas" icon={CheckCircle2}>
          {claim.tasks.length === 0 ? (
            <SmallEmpty>Nenhuma tarefa cadastrada.</SmallEmpty>
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
                    <span className="ml-2 text-xs text-[#6f89a5]">
                      {formatDate(task.due_on)}
                    </span>
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
                placeholder="Nova pendência"
                aria-label="Nova tarefa"
              />
              <input
                className="input"
                type="date"
                value={taskDueOn}
                onChange={(event) => setTaskDueOn(event.target.value)}
                aria-label="Vencimento da tarefa"
              />
              <select
                className="input"
                value={taskPriority}
                onChange={(event) => setTaskPriority(event.target.value)}
                aria-label="Prioridade da tarefa"
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </select>
              <button type="submit" className="btn-primary" disabled={busy || !taskTitle.trim()}>
                <CirclePlus className="h-4 w-4" />
              </button>
            </form>
          )}
        </Panel>
      </div>

      <Panel title="Histórico" icon={ClipboardList} className="mt-4">
        {claim.events.length === 0 ? (
          <SmallEmpty>Nenhum evento registrado.</SmallEmpty>
        ) : (
          claim.events.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-[#18314d] p-2 text-sm text-[#9fb7cf]"
            >
              <span className="text-[#6f89a5]">{formatDateTime(event.occurred_at)}</span>
              {' · '}
              {event.description}
            </div>
          ))
        )}
        {canManage && (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!note.trim()) return;
              onEvent(note.trim());
              setNote('');
            }}
          >
            <input
              className="input flex-1"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Registrar acompanhamento"
              aria-label="Novo acompanhamento"
            />
            <button type="submit" className="btn-primary" disabled={busy || !note.trim()}>
              Registrar
            </button>
          </form>
        )}
      </Panel>

      {canManage && (
        <div className="mt-4 flex justify-end">
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
    </section>
  );
}

function NewClaimForm({
  statuses,
  assignees,
  loading,
  onClose,
  onSubmit,
  error,
}: {
  statuses: ClaimStatus[];
  assignees?: {
    users: Array<{ id: string; name: string }>;
    teams: Array<{ id: string; name: string }>;
  };
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: CreateClaimInput) => void;
  error?: string;
}) {
  const [form, setForm] = useState({
    status_id: statuses[0]?.id || '',
    branch: '',
    insurer: '',
    opened_on: new Date().toISOString().slice(0, 10),
    responsible_user_id: '',
    team_id: '',
    expected_on: '',
    claim_number: '',
    service_type: '',
    workshop: '',
    insured_name: '',
    insured_phone: '',
    has_third_party: false,
    third_party_name: '',
    notes: '',
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const parties = [
      {
        role: 'segurado',
        name: form.insured_name.trim(),
        phone: form.insured_phone.trim() || undefined,
      },
    ];
    if (form.has_third_party && form.third_party_name.trim()) {
      parties.push({
        role: 'terceiro',
        name: form.third_party_name.trim(),
        phone: undefined,
      });
    }
    onSubmit({
      status_id: form.status_id,
      branch: form.branch.trim(),
      insurer: form.insurer.trim(),
      opened_on: form.opened_on,
      responsible_user_id: form.responsible_user_id || null,
      team_id: form.team_id || null,
      expected_on: form.expected_on || null,
      claim_number: form.claim_number.trim() || undefined,
      service_type: form.service_type.trim() || undefined,
      has_third_party: form.has_third_party,
      workshop: form.workshop.trim() || undefined,
      notes: form.notes.trim() || undefined,
      parties,
    });
  }

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="new-claim-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#244766] bg-[#081d30] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="new-claim-title" className="text-lg font-semibold text-white">
              Novo sinistro
            </h2>
            <p className="text-xs text-[#8faac4]">
              Cadastre o acompanhamento inicial; os demais eventos ficam na timeline.
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <Message kind="error">{error}</Message>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="Seguradora"
            value={form.insurer}
            onChange={(value) => update('insurer', value)}
            required
          />
          <Field
            label="Ramo"
            value={form.branch}
            onChange={(value) => update('branch', value)}
            required
          />
          <Field
            label="Data de abertura"
            type="date"
            value={form.opened_on}
            onChange={(value) => update('opened_on', value)}
            required
          />
          <Field
            label="Previsão"
            type="date"
            value={form.expected_on}
            onChange={(value) => update('expected_on', value)}
          />
          <Field
            label="Número do sinistro"
            value={form.claim_number}
            onChange={(value) => update('claim_number', value)}
          />
          <Field
            label="Tipo de atendimento"
            value={form.service_type}
            onChange={(value) => update('service_type', value)}
          />
          <Field
            label="Segurado"
            value={form.insured_name}
            onChange={(value) => update('insured_name', value)}
            required
          />
          <Field
            label="Telefone do segurado"
            value={form.insured_phone}
            onChange={(value) => update('insured_phone', value)}
          />
          <Field
            label="Oficina / prestador"
            value={form.workshop}
            onChange={(value) => update('workshop', value)}
          />
          <label className="text-sm text-[#b7cce0]">
            Status
            <select
              value={form.status_id}
              onChange={(event) => update('status_id', event.target.value)}
              className="input mt-1 w-full"
              required
            >
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#b7cce0]">
            Responsável
            <select
              value={form.responsible_user_id}
              onChange={(event) => update('responsible_user_id', event.target.value)}
              className="input mt-1 w-full"
            >
              <option value="">Sem responsável</option>
              {assignees?.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#b7cce0]">
            Equipe
            <select
              value={form.team_id}
              onChange={(event) => update('team_id', event.target.value)}
              className="input mt-1 w-full"
            >
              <option value="">Sem equipe</option>
              {assignees?.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[#b7cce0]">
            <input
              type="checkbox"
              checked={form.has_third_party}
              onChange={(event) => update('has_third_party', event.target.checked)}
            />
            Possui terceiro
          </label>
          {form.has_third_party && (
            <Field
              label="Nome do terceiro"
              value={form.third_party_name}
              onChange={(value) => update('third_party_name', value)}
              required
            />
          )}
          <label className="text-sm text-[#b7cce0] sm:col-span-2">
            Observações
            <textarea
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              className="input mt-1 min-h-24 w-full"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost rounded-xl" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-orange rounded-xl" disabled={loading}>
            {loading ? 'Salvando…' : 'Cadastrar sinistro'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm text-[#b7cce0]">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="input mt-1 w-full"
      />
    </label>
  );
}

function Panel({
  title,
  icon: Icon,
  className = '',
  children,
}: {
  title: string;
  icon: typeof Clock3;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`space-y-2 rounded-xl border border-[#18314d] bg-[#0b1d2d] p-3 ${className}`}>
      <h3 className="flex items-center gap-2 font-semibold text-white">
        <Icon className="h-4 w-4 text-[#00CBFF]" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[#6f89a5]">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function SmallEmpty({ children }: { children: string }) {
  return <p className="text-sm text-[#6f89a5]">{children}</p>;
}

function Message({
  children,
  kind = 'empty',
}: {
  children: string;
  kind?: 'empty' | 'error';
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm ${
        kind === 'error'
          ? 'border-red-400/30 bg-red-500/10 text-red-200'
          : 'border-dashed border-[#18314d] text-[#9fb7cf]'
      }`}
    >
      {children}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function money(value: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}
